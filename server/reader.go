package server

import (
	"github.com/Soreil/mnemonics"
	r "github.com/dancannon/gorethink"
)

// Reader reads on formats thread and post structs
type Reader struct {
	board                             string
	ident                             Ident
	canSeeMnemonics, canSeeModeration bool
}

// NewReader constructs a new Reader instance
func NewReader(board string, ident Ident) *Reader {
	return &Reader{
		board:            board,
		ident:            ident,
		canSeeMnemonics:  checkAuth("seeMnemonics", ident),
		canSeeModeration: checkAuth("seeModeration", ident),
	}
}

// Used to query equal joins of thread + OP from the DB
type joinedThread struct {
	Left  Thread `gorethink:"left"`
	Right Post   `gorethink:"right"`
}

// GetThread retrieves thread JSON from the database
func (rd *Reader) GetThread(id uint64, lastN int) ThreadContainer {
	// Verify thread exists. In case of HTTP requests, we kind of do 2
	// validations, but it's better to keep reader uniformity
	if !validateOP(id, rd.board) || !canAccessThread(id, rd.board, rd.ident) {
		return ThreadContainer{}
	}
	thread := getJoinedThread(id)
	if thread.Left.ID == 0 || thread.Right.ID == 0 {
		return ThreadContainer{}
	}

	// Get all other posts
	var posts []Post
	query := r.Table("posts").
		GetAllByIndex("op", id).
		Filter(r.Row.Field("id").Eq(id).Not()) // Exclude OP
	if lastN != 0 { // Only fetch last N number of replies
		query = query.Slice(-lastN + 1)
	}
	db()(query).All(&posts)

	// Parse posts, remove those that the client can not access and allocate the
	// rest to a map
	filtered := make(map[string]Post, len(posts))
	for _, post := range posts {
		parsed := rd.parsePost(post)
		if parsed.ID != 0 {
			filtered[idToString(parsed.ID)] = parsed
		}
	}

	// Compose into the client-side thread type
	return ThreadContainer{
		// Guranteed to have access rights, if thread is accessable
		Post:   rd.parsePost(thread.Right),
		Thread: thread.Left,
		Posts:  filtered,
	}
}

// Retrieve the thread metadata along with the OP post in the same format as
// multiple thread joins, for interoperability
func getJoinedThread(id uint64) (thread joinedThread) {
	db()(r.
		Expr(map[string]r.Term{
		"left":  getThread(id),
		"right": getPost(id).Without("op"),
	}).
		Merge(getThreadMeta()),
	).One(&thread)
	return
}

// Merges thread counters into the Left field of joinedThread
func getThreadMeta() map[string]map[string]r.Term {
	id := r.Row.Field("left").Field("id")
	return map[string]map[string]r.Term{
		"left": {
			// Count number of posts
			"postCtr": r.Table("posts").
				GetAllByIndex("op", id).
				Count().
				Sub(1),

			// Image count
			"imageCtr": r.Table("posts").
				GetAllByIndex("op", id).
				HasFields("src").
				Count().
				Sub(1),
		},
	}
}

// parsePost formats the Post struct according to the access level of the
// current client
func (rd *Reader) parsePost(post Post) Post {
	if !rd.canSeeModeration {
		if post.Deleted {
			return Post{}
		}
		if post.ImgDeleted {
			post.Image = Image{}
			post.ImgDeleted = false
		}
		post.Mod = ModerationList(nil)
	}
	if rd.canSeeMnemonics {
		mnem, err := mnemonic.Mnemonic(post.IP)
		throw(err)
		post.Mnemonic = mnem
	}
	post.IP = "" // Never pass IPs client-side
	return post
}

// GetPost reads a single post from the database
func (rd *Reader) GetPost(id uint64) Post {
	var post Post
	db()(getPost(id)).One(&post)
	if post.ID == 0 {
		return Post{}
	}
	post = rd.parsePost(post)
	if post.ID == 0 {
		return Post{}
	}
	return post
}

// GetBoard retrives all OPs of a single board
func (rd *Reader) GetBoard() (board Board) {
	var threads []joinedThread
	db()(r.
		Table("threads").
		GetAllByIndex("board", rd.board).
		EqJoin("id", r.Table("posts")).
		Merge(getThreadMeta()).
		Without(map[string]string{"right": "op"}),
	).All(&threads)
	board.Ctr = boardCounter(rd.board)
	board.Threads = rd.parseThreads(threads)
	return
}

// GetAllBoard retrieves all threads the client has access to for the "/all/"
// meta-board
func (rd *Reader) GetAllBoard() (board Board) {
	query := r.Table("threads")

	// Exclude staff board, if no access
	if !canAccessBoard(config.Boards.Staff, rd.ident) {
		query = query.Filter(r.Row.Field("board").Eq(config.Boards.Staff).Not())
	}

	query = query.
		EqJoin("id", r.Table("posts")).
		Merge(getThreadMeta()).
		Without(map[string]string{"right": "op"})

	var threads []joinedThread
	db()(query).All(&threads)
	board.Ctr = postCounter()
	board.Threads = rd.parseThreads(threads)
	return
}

// Parse and format board query results and discarding those threads, that the
// client can't access
func (rd *Reader) parseThreads(threads []joinedThread) []ThreadContainer {
	filtered := make([]ThreadContainer, 0, len(threads))
	for _, thread := range threads {
		if thread.Left.Deleted && !rd.canSeeModeration {
			continue
		}
		filtered = append(filtered, ThreadContainer{
			Thread: thread.Left,
			Post:   thread.Right,
		})
	}
	return filtered
}
