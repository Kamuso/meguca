var optSpecs = [];
var nashi = {opts: []}, inputMinSize = 300;
var shortcutKeys = {};

function extract_num(q) {
	return parseInt(q.attr('id'), 10);
}

function parent_post($el) {
	return $el.closest('article, section');
}

function parent_model($el) {
	var $a = parent_post($el);
	var op = extract_num($a);
	if (!op)
		return null;
	if ($a.is('section'))
		return Threads.get(op);
	var $s = $a.parent('section');
	if (!$s.length) {
		// when we have better hover/inline expansion we will have to
		// deal with this, probably by setting data-op on the post
		console.warn($a, "'s parent is not thread?!");
		return null;
	}
	var num = op;
	op = extract_num($s);
	return Threads.lookup(num, op);
}

(function () {

/* OPTIONS LIST */
optSpecs.push(option_inline_expansion);
optSpecs.push(option_thumbs);
if (!isMobile){
	optSpecs.push(option_image_hover);
	optSpecs.push(option_webm_hover);
	optSpecs.push(option_autogif);
}
optSpecs.push(option_spoiler);
optSpecs.push(option_backlinks);
optSpecs.push(option_linkify);
optSpecs.push(option_notification);
optSpecs.push(option_relative_time);
optSpecs.push(option_syncwatch);
if (hotConfig.RADIO_BANNER && !isMobile)
	optSpecs.push(option_now_playing);
optSpecs.push(option_google);
optSpecs.push(option_iqdb);
optSpecs.push(option_saucenao);
optSpecs.push(option_foolz);
optSpecs.push(option_exhentai);
if (hotConfig.ILLYA_DANCE && !isMobile){
	optSpecs.push(option_illya_dance);
	optSpecs.push(option_illya_mute);
}
optSpecs.push(option_horizontal);
optSpecs.push(option_reply_at_right);
optSpecs.push(option_theme);
if (!isMobile){
	optSpecs.push(option_user_bg);
	optSpecs.push(option_user_bg_image);
}
optSpecs.push(option_last_n);
optSpecs.push(option_postUnloading);

nashi.upload = !!$('<input type="file"/>').prop('disabled');

if (window.screen && screen.width <= 320)
	inputMinSize = 50;

function load_ident() {
	try {
		var id = JSON.parse(localStorage.ident);
		if (id.name)
			$name.val(id.name);
		if (id.email)
			$email.val(id.email);
	}
	catch (e) {}
}

function save_ident() {
	try {
		var name = $name.val(), email = $email.val();
		if (email == 'misaki') {
			$email.val('');
			yepnope(mediaURL + 'js/login.js?v=2');
			email = false;
		}
		else if (is_sage(email) && !is_noko(email))
			email = false;
		var id = {};
		if (name || email) {
			if (name)
				id.name = name;
			if (email)
				id.email = email;
			localStorage.setItem('ident', JSON.stringify(id));
		}
		else
			localStorage.removeItem('ident');
	}
	catch (e) {}
}

options.on('change', function () {
	try {
		localStorage.options = JSON.stringify(options);
	}
	catch (e) {}
});

/* LAST N CONFIG */

function option_last_n(n) {
	if (!reasonable_last_n(n))
		return;
	$.cookie('lastn', n, {path: '/'});
	// should really load/hide posts as appropriate
}
option_last_n.id = 'lastn';
option_last_n.label = '[Last #]';
option_last_n.type = 'positive';
option_last_n.tooltip = 'Number of posts to display with the "Last n" thread expansion link';

oneeSama.lastN = options.get('lastn');
options.on('change:lastn', function (model, lastN) {
	oneeSama.lastN = lastN;
});

/* KEEP THREAD LENGTH WITHIN LASTN */

function option_postUnloading(toggle){}

option_postUnloading.id = 'postUnloading';
option_postUnloading.label = 'Dynamic Post Unloading';
option_postUnloading.type = 'revcheckbox';
option_postUnloading.tooltip = 'Improves thread responsiveness by unloading posts from the'+
		' top of the thread, so that post count stays within the Last # value. Only applies to '+
		'Last # enabled threads';

/* THEMES */

var themes = [
	'moe',
	'gar',
	'mawaru',
	'moon',
	'ashita',
	'console',
	'tea',
	'higan',
	'rave',
	'tavern',
	'glass',
];

function option_theme(theme) {
	if (theme) {
		var css = theme + '.css?v=' + themeVersion;
		$('#theme').attr('href', mediaURL + 'css/' + css);
	}
	append_glass();
}

option_theme.id = 'board.$BOARD.theme';
option_theme.label = 'Theme';
option_theme.type = themes;
option_theme.tooltip = 'Select CSS theme';

/* THUMBNAIL OPTIONS */

var revealSetup = false;

function option_thumbs(type) {
	$.cookie('thumb', type);
	oneeSama.thumbStyle = type;
}

option_thumbs.id = 'thumbs';
option_thumbs.label = 'Thumbnails';
option_thumbs.type = thumbStyles;
option_thumbs.tooltip = 'Set thumbnail type: ' +
	'Small: 125x125, small file size; ' +
	'Sharp: 125x125, more detailed; ' +
	'Hide: hide all images;';

/* REPLY AT RIGHT */

function option_reply_at_right(r) {
	if (r)
		$('<style/>', {
			id: 'reply-at-right',
			text: 'aside { margin: -26px 0 2px auto; }',
		}).appendTo('head');
	else
		$('#reply-at-right').remove();
}
option_reply_at_right.id = 'replyright';
option_reply_at_right.label = '[Reply] at right';
option_reply_at_right.type = 'checkbox';
option_reply_at_right.tooltip = 'Move Reply button to the right side of the page';

/* BACKLINKS */

function option_backlinks(b) {
	if (b)
		$('small').remove();
	else
		show_backlinks();
}
option_backlinks.id = 'nobacklinks';
option_backlinks.label = 'Backlinks';
option_backlinks.type = 'revcheckbox';
option_backlinks.tooltip = 'Links to replies of current post';

function show_backlinks() {
	if (load_thread_backlinks) {
		with_dom(function () {
			$('section').each(function () {
				load_thread_backlinks($(this));
			});
		});
		load_thread_backlinks = null;
		return;
	}

	Threads.each(function (thread) {
		thread.get('replies').each(function (reply) {
			if (reply.has('backlinks'))
				reply.trigger('change:backlinks');
		});
	});
}

var load_thread_backlinks = function ($section) {
	var op = extract_num($section);
	var replies = Threads.get(op).get('replies');
	$section.find('blockquote a').each(function () {
		var $a = $(this);
		var m = $a.attr('href').match(/^\d*#(\d+)$/);
		if (!m)
			return;
		var destId = parseInt(m[1], 10);
		if (!replies.get(destId)) // local backlinks only for now
			return;
		var src = replies.get(extract_num(parent_post($a)));
		if (!src)
			return;
		var update = {};
		update[destId] = op;
		add_post_links(src, update, op);
	});
};

/* LINKIFY TEXT URLS */

function option_linkify(toggle){
	$.cookie('linkify', toggle, {path: '/'});
}

option_linkify.id = 'linkify';
option_linkify.label = 'Linkify text URLs';
option_linkify.type = 'checkbox';
option_linkify.tooltip = 'Convert in-post text URLs to clickable links. WARNING: Potential security hazard (XSS). Requires page refresh.';

/* RELATIVE POST TIMESTAMPS */

function option_relative_time(toggle){
	$.cookie('rTime', toggle, {path: '/'});
}

option_relative_time.id = 'relativeTime';
option_relative_time.label = 'Relative Timestamps';
option_relative_time.type = 'checkbox';
option_relative_time.tooltip = 'Relative post timestamps. Ex.: "1 hour ago." Requires page refresh';

/* SYNCWATCH */

function option_syncwatch(toggle){}

option_syncwatch.id = 'syncWatch';
option_syncwatch.label = 'Syncwatch';
option_syncwatch.type = 'checkbox';
option_syncwatch.tooltip = 'Transform #sw hash commands into syncronised duration progress timers. Does not stop already running timers. Not recommended on mobile devices.';

/* R/A/DIO NOW PLAYING BANNER */

var now_playing_timer;
function option_now_playing(toggle){
	if (!toggle){
		var song;
		(function write_banner(){
			// Query the r/a/dio API
			$.getJSON('https://r-a-d.io/api', function(data){
				if (!data || !data.main)
					return;
				var main = data.main;
				// No changes, no need to rewite banner
				if (song == main.np)
					return;
				var info ='<a href="http://r-a-d.io/" target="_blank">' + '[' + main.listeners + '] ' +
						main.dj.djname + '</a>' + '&nbsp;&nbsp;<a title="Click to google song" href="https://google.com/search?q=' +
						encodeURIComponent(main.np) + '" target="_blank"><b>' + main.np + '</b></a>';
				$('#banner_center').html(info);
			})
				// Schedule a new requests, even if the fetch fails
				.always(function(){
					now_playing_timer = setTimeout(write_banner, 10000);
				});
		})();
	} else {
		// Stop updating the banner
		clearTimeout(now_playing_timer);
		$('#banner_center').html('');
	}
}

option_now_playing.id = 'nowPlaying';
option_now_playing.label = 'Now Playing Banner';
option_now_playing.type = 'revcheckbox';
option_now_playing.tooltip = 'Currently playing song on r/a/dio and other stream information in the top banner.';

/* IMAGE SEARCH LINK TOGGLE */

$('head').append('<style id="googleToggle">.google{display:none;}</style>');
$('head').append('<style id="iqdbToggle">.iqdb{display:none;}</style>');
$('head').append('<style id="saucenaoToggle">.saucenao{display:none;}</style>');
$('head').append('<style id="foolzToggle">.foolz{display:none;}</style>');
$('head').append('<style id="exhentaiToggle">.exhentai{display:none;}</style>');

function toggle_image_search(toggle, cls){
	$('#'+cls+'Toggle').prop('disabled', toggle);
}

function option_google(toggle){
	toggle_image_search(toggle, 'google');
}
option_google.id = 'google';
option_google.label = 'Google Image Search';
option_google.type = 'checkbox';
option_google.tooltip = 'Show/hide Google image search links';

function option_iqdb(toggle){
	toggle_image_search(toggle, 'iqdb');
}
option_iqdb.id = 'iqdb';
option_iqdb.label = 'IQDB Image Search';
option_iqdb.type = 'checkbox';
option_iqdb.tooltip = 'Show/hide IQDB image search links';

function option_saucenao(toggle){
	toggle_image_search(toggle, 'saucenao');
}
option_saucenao.id = 'saucenao';
option_saucenao.label = 'Saucenao Image Search';
option_saucenao.type = 'checkbox';
option_saucenao.tooltip = 'Show/hide Saucenao image search links';

function option_foolz(toggle){
	toggle_image_search(toggle, 'foolz');
}
option_foolz.id = 'foolz';
option_foolz.label = 'Foolz Archive Image Search';
option_foolz.type = 'checkbox';
option_foolz.tooltip = 'Show/hide Foolz archive image search links';

function option_exhentai(toggle){
	toggle_image_search(toggle, 'exhentai');
}
option_exhentai.id = 'exhentai';
option_exhentai.label = 'Exhentai Image Search';
option_exhentai.type = 'checkbox';
option_exhentai.tooltip = 'Show/hide Exhentai image search links';

/* SPOILER TOGGLE */


function option_spoiler(spoilertoggle) {
	$.cookie('spoil',spoilertoggle, {path: '/'});
	oneeSama.spoilToggle = spoilertoggle;
}
option_spoiler.id = 'noSpoilers';
option_spoiler.label = 'Image Spoilers';
option_spoiler.type = 'revcheckbox';
option_spoiler.tooltip = "Don't spoiler images";

/* Autogif TOGGLE */


function option_autogif(autogif) {
	$.cookie('agif',autogif, {path: '/'});
	oneeSama.autoGif = autogif;
}
option_autogif.id = 'autogif';
option_autogif.label = 'Animated GIF Thumbnails';
option_autogif.type = 'checkbox';
option_autogif.tooltip = 'Animate GIF thumbnails';

/* NOTIFICATIONS */

function option_notification(notifToggle) {
	if(notifToggle && (Notification.permission !== "granted"))
		Notification.requestPermission();
}

option_notification.id = 'notification';
option_notification.label = 'Desktop Notifications';
option_notification.type = 'checkbox';
option_notification.tooltip = 'Get desktop notifications when quoted or a syncwatch is about to start';

/* ILLYA DANCE */

function option_illya_dance(illyatoggle){
	var muted = ' ';
	if (options.get(option_illya_mute.id))
		muted = 'muted';
	var dancer = '<video autoplay ' + muted + ' loop id="bgvid" >' +
			'<source src="' + mediaURL + 'illya.webm" type="video/webm">' +
			'<source src="' + mediaURL + 'illya.mp4" type="video/mp4">' +
		'</video>';
	if (illyatoggle)
		$("body").append(dancer);
	else
		$("#bgvid").remove();
}

option_illya_dance.id = 'board.$BOARD.illyaBGToggle';
option_illya_dance.label = 'Illya Dance';
option_illya_dance.type = 'checkbox';
option_illya_dance.tooltip = 'Dancing loli in the background';

function option_illya_mute(toggle){
	if (options.get(option_illya_dance.id)){
		option_illya_dance(false);
		option_illya_dance(true);
	}	
}

option_illya_mute.id = 'illyaMuteToggle';
option_illya_mute.label = 'Mute Illya';
option_illya_mute.type = 'checkbox';
option_illya_mute.tooltip = 'Mute dancing loli';

/* HORIZONTAL POSTING */

function option_horizontal(toggle){
	var style = '<style id="horizontal">article,aside{display:inline-block;}</style>';
	if (toggle)
		$('head').append(style);
	else 
		$('#horizontal').remove();
}

option_horizontal.id = 'horizontalPosting';
option_horizontal.label = 'Horizontal Posting';
option_horizontal.type = 'checkbox';
option_horizontal.tooltip = '38chan nostalgia';

/* CUSTOM USER-SET BACKGROUND */

function option_user_bg(toggle){
	if (localStorage.userBG && toggle){
		var image = localStorage.userBG;
		$('body').append($('<img />', {
			id: 'user_bg',
			src: image
		}));
		// Append blurred BG, if theme is glass
		append_glass();
	}
	else {
		$('#user_bg').remove();
		$('#blurred').remove();
	}
}

option_user_bg.id = 'board.$BOARD.userBG';
option_user_bg.label = 'Custom Background';
option_user_bg.type = 'checkbox';
option_user_bg.tooltip = 'Toggle custom page background';

function option_user_bg_image(target){
	if (target){
		// Read image from disk
		var reader = new FileReader();
		reader.onload = function(event){
			var img = new Image();
			img.onload = function(){
				// Prevent memory leaks
				$(this).remove();
				localStorage.userBG = img.src;
				// Blur with Pixastic
				Pixastic.process(img, 'blurfast', {amount: 1.5}, function(blurred){
					localStorage.userBGBlurred = blurred.toDataURL('image/jpeg', 0.9);
					if (options.get(option_user_bg.id))
						option_user_bg(true);
				});
			};
			img.src = event.target.result;
		};
		reader.readAsDataURL(target.files[0]);
	}
}

function append_glass(){
	// Check if theme is glass, user-bg is set and blurred BG is generated
	if (options.get(option_theme.id) == 'glass' && options.get(option_user_bg.id) &&
		localStorage.userBG && localStorage.userBGBlurred){
			// Apply blurred background
			var blurred = localStorage.userBGBlurred;
			$('#blurred').remove();
			$('<style />', {id: 'blurred'})
				.appendTo('head')
				.html(
					'article, aside, .pagination, .popup-menu, .modal, .bmodal, .preview, #banner {\
						background:\
							linear-gradient(rgba(40, 42, 46, 0.5), rgba(40, 42, 46, 0.5)),' +
							'url(' + blurred + ') center fixed no-repeat; background-size: cover;}' +
					'.editing{\
						background:\
							linear-gradient(rgba(145, 145, 145, 0.5), rgba(145, 145, 145, 0.5)),' +
							'url(' + blurred + ') center fixed no-repeat !important; background-size: cover;}'
				);
	} else
		$('#blurred').remove();
}

option_user_bg_image.id = 'userBGimage';
option_user_bg_image.label = '';
option_user_bg_image.type = 'image';
option_user_bg_image.tooltip = "Image to use as the background";

/* IMAGE HOVER EXPANSION */

function imageHoverPreview(){
	// Check if hovering over image or image is expanded by clicking
	var $target = $(mouseoverTarget);
	if (!$target.is('img') || $target.hasClass('expanded'))
		return fadeOutHoverOverlay();
	var src = $target.closest('a').attr('href');
	var isWebm = /\.webm/i.test(src);
	// Check if WebM hover expansion is enabled
	if (isWebm && !options.get('webmHover'))
		return fadeOutHoverOverlay();
	var $img  = $(isWebm ? '<video />' : '<img />', {
		id: 'hover_overlay_image',
		'src': src,
		autoplay: true,
		loop: true,
	});
	// Gracefully fade out previous image
	var $old = $('#hover_overlay_image');
	if ($old.length){
		fadeOutHoverOverlay(function(){
			fadeInHoverOverlay($img);
		});
	}
	else
		fadeInHoverOverlay($img);
}

function fadeInHoverOverlay($img){
	$('#hover_overlay').append($img);
	$('#hover_overlay_image').fadeIn({duration: 200});
}

function fadeOutHoverOverlay(cb){
	// Do nothing, if image is already removed
	var $img = $('#hover_overlay_image');
	if (!$img.length)
		return;
	$img.fadeOut({duration: 200, complete: function(){
		$img.remove();
		// More responsive transition with fast pointer movements
		imageHoverPreview();
	}});
	if (typeof cb === 'function')
		cb();
}

function option_image_hover(toggle){
	if (toggle)
		$DOC.on('mouseover', imageHoverPreview).on('click', 'img, video', fadeOutHoverOverlay);
	else
		$DOC.off('mouseover', imageHoverPreview).off('click', 'img, video', fadeOutHoverOverlay);
}

option_image_hover.id = 'imageHover';
option_image_hover.label = 'Image Hover Expansion';
option_image_hover.type = 'checkbox';
option_image_hover.tooltip = 'Display image previews on hover';

// Toogle hover expansion of WebM
function option_webm_hover(){}

option_webm_hover.id = 'webmHover';
option_webm_hover.label = 'WebM Hover Expansion';
option_webm_hover.type = 'checkbox';
option_webm_hover.tooltip = 'Display WebM previews on hover. Requires Image Hover Expansion enabled.';

/* INLINE EXPANSION */

function option_inline_expansion() {}

option_inline_expansion.id = 'inlinefit';
option_inline_expansion.label = 'Expansion';
option_inline_expansion.type = ['none', 'full', 'width', 'height', 'both'];
option_inline_expansion.labels = ['none', 'full-size', 'fit to width',
		'fit to height', 'fit to both'];
option_inline_expansion.tooltip = "Expand images inside the parent post and resize according to setting";

/* SHORTCUT KEYS */

var shortcuts = [
	{label: 'New post', name: 'new', which: 78},
	{label: 'Image spoiler', name: 'togglespoiler', which: 73},
	{label: 'Finish post', name: 'done', which: 83},
];

function toggle_shortcuts(event) {
	event.preventDefault();
	var $shortcuts = $('#shortcuts');
	if ($shortcuts.length)
		return $shortcuts.remove();
	$shortcuts = $('<div/>', {
		id: 'shortcuts',
		click: select_shortcut,
		keyup: change_shortcut,
	});
	shortcuts.forEach(function (s) {
		var value = String.fromCharCode(shortcutKeys[s.name]);
		var $label = $('<label>', {text: s.label});
		$('<input>', {
			id: s.name, maxlength: 1, val: value,
		}).prependTo($label);
		$label.prepend(document.createTextNode('Alt+'));
		$shortcuts.append($label, '<br>');
	});
	$shortcuts.appendTo('#options-panel');
}

function select_shortcut(event) {
	if ($(event.target).is('input'))
		$(event.target).val('');
}

function change_shortcut(event) {
	if (event.which == 13)
		return false;
	var $input = $(event.target);
	var letter = $input.val();
	if (!(/^[a-z]$/i.exec(letter)))
		return;
	var which = letter.toUpperCase().charCodeAt(0);
	var name = $input.attr('id');
	if (!(name in shortcutKeys))
		return;
	shortcutKeys[name] = which;

	var shorts = options.get('shortcuts')
	if (!_.isObject(shorts)) {
		shorts = {};
		shorts[name] = which;
		options.set('shortcuts', shorts);
	}
	else {
		shorts[name] = which;
		options.trigger('change'); // force save
	}

	$input.blur();
}

_.defer(function () {
	load_ident();
	var save = _.debounce(save_ident, 1000);
	function prop() {
		if (postForm)
			postForm.propagate_ident();
		save();
	}
	$name.input(prop);
	$email.input(prop);

	optSpecs.forEach(function (spec) {
		spec.id = spec.id.replace(/\$BOARD/g, BOARD);
	});

	$('#options').click(function () {
		var $opts = $('#options-panel');
		if (!$opts.length)
			$opts = make_options_panel().appendTo('body');
		if ($opts.is(':hidden'))
			oneeSama.trigger('renderOptions', $opts);
		position_bmodal('#options-panel');
	});

	optSpecs.forEach(function (spec) {
		spec(options.get(spec.id));
	});

	var prefs = options.get('shortcuts') || {};
	shortcuts.forEach(function (s) {
		shortcutKeys[s.name] = prefs[s.name] || s.which;
	});
});

/* TOGGLER FOR TOP BANNER BUTTONS */

function position_bmodal(target){
	if (!$(target).is(':visible')){
		$(target).css('top', $('#banner').outerHeight() + 5 + 'px');
		$('.bmodal:visible').toggle('fast');
	}
	$(target).toggle('fast');
}
$('#banner_FAQ').click(function(){
	position_bmodal('#FAQ');
});
$('#banner_schedule').click(function(){
	position_bmodal('#schedule');
});
$('#banner_identity').click(function(){
	position_bmodal('#identity');
});

// Highlight options button, if no options are set
if (!localStorage.getItem('options')){
	$('#options').addClass('noOptions');
	function fadeout(){
		$('.noOptions').fadeOut(fadein);
	}
	function fadein(){
		// Stop animation, if options pannel is opened
		if (!$('.noOptions').length)
			$('#options').fadeIn();
		$('.noOptions').fadeIn(fadeout);
	}
	fadeout();
	
	$('#options').click(function(){
		$('#options').removeClass('noOptions');
	});
}

function make_options_panel() {
	var $opts = $('<div/>', {"class": 'bmodal', id: 'options-panel'});
	$opts.change(function (event) {
		var $o = $(event.target), id = $o.attr('id'), val;
		var spec = _.find(optSpecs, function (s) {
			return s.id == id;
		});
		if (!spec)
			return;
		if (spec.type == 'checkbox')
			val = !!$o.prop('checked');
		else if (spec.type == 'revcheckbox')
			val = !$o.prop('checked');
		else if (spec.type == 'positive')
			val = Math.max(parseInt($o.val(), 10), 1);
		else if (spec.type == 'image')
			val = event.target;
		else
			val = $o.val();
		options.set(id, val);
		with_dom(function () {
			spec(val);
		});
	});
	optSpecs.forEach(function (spec) {
		var id = spec.id;
		if (nashi.opts.indexOf(id) >= 0)
			return;
		var val = options.get(id), $input, type = spec.type;
		if (type == 'checkbox' || type == 'revcheckbox') {
			var b = (type == 'revcheckbox') ? !val : val;
			$input = $('<input type="checkbox" />')
				.prop('checked', b ? 'checked' : null);
		}
		else if (type == 'positive') {
			$input = $('<input />', {
				width: '4em',
				maxlength: 4,
				val: val,
			});
		} else if (type == 'image'){
			$input = $('<input />', {
				type: 'file',
				title: spec.tooltip,
			});
		}
		else if (type instanceof Array) {
			$input = $('<select/>');
			var labels = spec.labels || {};
			type.forEach(function (item, i) {
				var label = labels[i] || item;
				$('<option/>')
					.text(label).val(item)
					.appendTo($input);
			});
			if (type.indexOf(val) >= 0)
				$input.val(val);
		}
		var $label = $('<label/>').attr('for', id).attr('title', spec.tooltip).text(spec.label);
		$opts.append($input.attr('id', id).attr('title', spec.tooltip), ' ', $label, '<br>');
	});
	if (!nashi.shortcuts) {
		$opts.append($('<a/>', {
			href: '#', text: 'Keyboard Shortcuts',
			click: toggle_shortcuts,
		}));
	}
	oneeSama.trigger('initOptions', $opts);
	return $opts.hide();
}

})();
