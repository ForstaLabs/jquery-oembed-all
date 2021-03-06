/*!
 * jquery oembed plugin
 *
 * Copyright (c) 2009 Richard Chamorro
 * Licensed under the MIT license
 *
 * Orignal Author: Richard Chamorro
 * Forked by Andrew Mee to Provide a slightly diffent kind of embedding experience
 *
 */
(function ($) {
    $.fn.oembed = function (url, options, embedAction) {
        const settings = $.extend(/*deep*/ true, {}, defaults, options);
        if ($('#jqoembeddata').length === 0) {
            $('<span id="jqoembeddata"></span>').appendTo('body');
        }
        return this.each(function () {
            var container = $(this),
                resourceURL = (url && (!url.indexOf('http://') || !url.indexOf('https://'))) ? url : container.attr("href"),
                provider;
            if (embedAction) {
                settings.onEmbed = embedAction;
            } else if (!settings.onEmbed) {
                settings.onEmbed = function (oembedData) {
                    $.fn.oembed.insertCode(this, settings.embedMethod, oembedData, settings);
                };
            }
            if (resourceURL) {
                provider = $.fn.oembed.getOEmbedProvider(resourceURL);
                if (!settings.fallback) {
                    provider = provider.name.toLowerCase() === 'opengraph' ? null : provider;
                }
                if (provider) {
                    provider.params = getNormalizedParams(settings[provider.name]) || {};
                    provider.maxWidth = settings.maxWidth;
                    provider.maxHeight = settings.maxHeight;
                    embedCode(container, resourceURL, provider, settings);
                } else {
                    settings.onProviderNotFound.call(container, resourceURL);
                }
            }
            return container;
        });
    };

    const defaults = $.fn.oembed.defaults = {
        fallback: true,
        maxWidth: null,
        maxHeight: null,
        includeHandle: true,
        embedMethod: 'auto',
        // "auto", "append", "fill"
        onProviderNotFound: function () {
        },
        beforeEmbed: function () {
        },
        afterEmbed: function () {
        },
        onEmbed: false,
        onError: function (a, b, c, d) {
            console.error('oembed error:', a, b, c, d);
        },
        ajaxOptions: {}
    };

    /* Private functions */
    function rand(length, current) { //Found on http://stackoverflow.com/questions/1349404/generate-a-string-of-5-random-characters-in-javascript
        current = current ? current : '';
        return length ? rand(--length, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz".charAt(Math.floor(Math.random() * 60)) + current) : current;
    }

    function getRequestUrl(provider, externalUrl) {
        var url = provider.apiendpoint,
            qs = "";
        url += (url.indexOf("?") <= 0) ? "?" : "&";
        url = url.replace('#', '%23');

        if (provider.maxWidth !== null && (typeof provider.params.maxwidth === 'undefined' || provider.params.maxwidth === null)) {
            provider.params.maxwidth = provider.maxWidth;
        }

        if (provider.maxHeight !== null && (typeof provider.params.maxheight === 'undefined' || provider.params.maxheight === null)) {
            provider.params.maxheight = provider.maxHeight;
        }

        for (const i in provider.params) {
            // We don't want them to jack everything up by changing the callback parameter
            if (i == provider.callbackparameter)
                continue;

            // allows the options to be set to null, don't send null values to the server as parameters
            if (provider.params[i] !== null)
                qs += "&" + escape(i) + "=" + provider.params[i];
        }

        url += "format=" + provider.format + "&url=" + escape(externalUrl) + qs;
        if (provider.dataType != 'json')
            url += "&" + provider.callbackparameter + "=?";

        return url;
    }

    function success(oembedData, externalUrl, container, settings) {
        $('#jqoembeddata').data(externalUrl, oembedData.code);
        settings.beforeEmbed.call(container, oembedData);
        settings.onEmbed.call(container, oembedData);
        settings.afterEmbed.call(container, oembedData);
    }

    function embedCode(container, externalUrl, embedProvider, settings) {
        if ($('#jqoembeddata').data(externalUrl) != undefined && embedProvider.embedtag.tag != 'iframe') {
            var oembedData = {code: $('#jqoembeddata').data(externalUrl)};
            success(oembedData, externalUrl, container, settings);
        } else if (embedProvider.templateRegex) {
            if (embedProvider.embedtag.tag !== '') {
                var flashvars = embedProvider.embedtag.flashvars || '';
                var tag = embedProvider.embedtag.tag || 'embed';
                var width = embedProvider.embedtag.width || 'auto';
                var height = embedProvider.embedtag.height || 'auto';
                var src = externalUrl.replace(embedProvider.templateRegex, embedProvider.apiendpoint);

                if (!embedProvider.nocache) {
                    const sep = src.indexOf('?') === -1 ? '?' : '&';
                    src += `${sep}jqoemcache=${rand(5)}`;
                }

                if (embedProvider.apikey) {
                    src = src.replace('_APIKEY_', settings.apikeys[embedProvider.name]);
                }

                var code = $('<' + tag + '/>').attr('src', src).attr('width', width)
                    .attr('height', height)
                    .attr('allowfullscreen', embedProvider.embedtag.allowfullscreen || 'true')
                    .attr('allowscriptaccess', embedProvider.embedtag.allowfullscreen || 'always')
                    .css('max-height', settings.maxHeight || 'auto')
                    .css('max-width', settings.maxWidth || 'auto');

                if (tag == 'embed') {
                    code.attr('type', embedProvider.embedtag.type || "application/x-shockwave-flash")
                        .attr('flashvars', externalUrl.replace(embedProvider.templateRegex, flashvars));
                }

                if (tag == 'iframe') {
                    code.attr('scrolling', embedProvider.embedtag.scrolling || "no")
                        .attr('frameborder', embedProvider.embedtag.frameborder || "0");

                }

                success({code: code}, externalUrl, container, settings);
            } else if (embedProvider.apiendpoint) {
                //Add APIkey if true
                if (embedProvider.apikey)
                    embedProvider.apiendpoint = embedProvider.apiendpoint.replace('_APIKEY_', settings.apikeys[embedProvider.name]);
                const url = externalUrl.replace(embedProvider.templateRegex, embedProvider.apiendpoint);
                const onSuccess = data => {
                        var oembedData = $.extend({}, data);
                        oembedData.code = embedProvider.templateData(data);
                        success(oembedData, externalUrl, container, settings);
                };
                if (embedProvider.method === 'fetch') {
                    fetch(url).then(r => r.json().then(onSuccess)).catch(e => settings.onError.call(container, e, externalUrl, embedProvider));
                } else {
                    ajaxopts = $.extend({
                        url,
                        dataType: 'jsonp',
                        success: onSuccess,
                        error: (xhr, statusText, e) => settings.onError.call(container, e, externalUrl, embedProvider)
                    }, settings.ajaxOptions || {});
                    $.ajax(ajaxopts);
                }
            } else {
                success({code: externalUrl.replace(embedProvider.templateRegex, embedProvider.template)}, externalUrl, container, settings);
            }
        } else {

            var requestUrl = getRequestUrl(embedProvider, externalUrl);
            ajaxopts = $.extend({
                url: requestUrl,
                dataType: embedProvider.dataType || 'jsonp',
                success: function (data) {
                    var oembedData = $.extend({}, data);
                    switch (oembedData.type) {
                        case "file": //Deviant Art has this
                        case "photo":
                            oembedData.code = $.fn.oembed.getPhotoCode(externalUrl, oembedData);
                            break;
                        case "video":
                        case "rich":
                            oembedData.code = $.fn.oembed.getRichCode(externalUrl, oembedData);
                            break;
                        default:
                            oembedData.code = $.fn.oembed.getGenericCode(externalUrl, oembedData);
                            break;
                    }
                    success(oembedData, externalUrl, container, settings);
                },
                error: (xhr, statusText, e) => settings.onError.call(container, e, externalUrl, embedProvider)
            }, settings.ajaxOptions || {});
            $.ajax(ajaxopts);
        }
    }

    function getNormalizedParams(params) {
        if (params === null) return null;
        var key, normalizedParams = {};
        for (key in params) {
            if (key !== null) normalizedParams[key.toLowerCase()] = params[key];
        }
        return normalizedParams;
    }

    /* Public functions */
    $.fn.oembed.insertCode = function (container, embedMethod, oembedData, settings) {
        if (oembedData === null)
            return;

        if (embedMethod === 'auto' && container.attr('href') !== null) {
            embedMethod = 'append';
        } else if (embedMethod == 'auto') {
            embedMethod = 'replace';
        }

        switch (embedMethod) {
            case "replace":
                container.replaceWith(oembedData.code);
                break;
            case "fill":
                container.html(oembedData.code);
                break;
            case "append":
                container.wrap('<div class="oembedall-container"></div>');
                var oembedContainer = container.parent();
                if (settings.includeHandle) {
                    $('<span class="oembedall-closehide">&darr;</span>').insertBefore(container).click(function () {
                        var encodedString = encodeURIComponent($(this).text());
                        $(this).html((encodedString == '%E2%86%91') ? '&darr;' : '&uarr;');
                        $(this).parent().children().last().toggle();
                    });
                }
                oembedContainer.append('<br/>');
                try {
                    oembedData.code.clone().appendTo(oembedContainer);
                } catch (e) {
                    oembedContainer.append(oembedData.code);
                }
                /* Make videos semi-responsive
                 * If parent div width less than embeded iframe video then iframe gets shrunk to fit smaller width
                 * If parent div width greater thans embed iframe use the max widht
                 * - works on youtubes and vimeo
                 */
                if (settings.maxWidth) {
                    var post_width = oembedContainer.parent().width();
                    if (post_width < settings.maxWidth) {
                        var iframe_width_orig = $('iframe', oembedContainer).width();
                        var iframe_height_orig = $('iframe', oembedContainer).height();
                        var ratio = iframe_width_orig / post_width;
                        $('iframe', oembedContainer).width(iframe_width_orig / ratio);
                        $('iframe', oembedContainer).height(iframe_height_orig / ratio);
                    } else {
                        if (settings.maxWidth) {
                            $('iframe', oembedContainer).width(settings.maxWidth);
                        }
                        if (settings.maxHeight) {
                            $('iframe', oembedContainer).height(settings.maxHeight);
                        }
                    }
                }
                break;
        }
    };

    $.fn.oembed.getPhotoCode = function (url, oembedData) {
        var code;
        var alt = oembedData.title ? oembedData.title : '';
        alt += oembedData.author_name ? ' - ' + oembedData.author_name : '';
        alt += oembedData.provider_name ? ' - ' + oembedData.provider_name : '';

        if (oembedData.url) {
            code = '<div><a href="' + url + '" target=\'_blank\'><img src="' + oembedData.url + '" alt="' + alt + '"/></a></div>';
        } else if (oembedData.thumbnail_url) {
            var newURL = oembedData.thumbnail_url.replace('_s', '_b');
            code = '<div><a href="' + url + '" target=\'_blank\'><img src="' + newURL + '" alt="' + alt + '"/></a></div>';
        } else {
            code = '<div>Error loading this picture</div>';
        }

        if (oembedData.html) {
            code += "<div>" + oembedData.html + "</div>";
        }

        return code;
    };

    $.fn.oembed.getRichCode = function (url, oembedData) {
        return oembedData.html;
    };

    $.fn.oembed.getGenericCode = function (url, oembedData) {
        var title = ((oembedData.title) && (oembedData.title !== null)) ? oembedData.title : url;
        var code = '<a href="' + url + '">' + title + '</a>';

        if (oembedData.html) {
            code += "<div>" + oembedData.html + "</div>";
        }

        return code;
    };

    $.fn.oembed.getOEmbedProvider = function (url) {
        for (var i = 0; i < $.fn.oembed.providers.length; i++) {
            for (var j = 0, l = $.fn.oembed.providers[i].urlschemes.length; j < l; j++) {
                var regExp = new RegExp($.fn.oembed.providers[i].urlschemes[j], "i");
                if (url.match(regExp) !== null) {
                    return $.fn.oembed.providers[i];
                }
            }
        }
        return null;
    };

    // Constructor Function for OEmbedProvider Class.
    $.fn.oembed.OEmbedProvider = function (name, type, urlschemesarray, apiendpoint, extraSettings) {
        this.name = name;
        this.type = type; // "photo", "video", "link", "rich", null
        this.urlschemes = urlschemesarray;
        this.apiendpoint = apiendpoint;
        this.maxWidth = 500;
        this.maxHeight = 400;
        extraSettings = extraSettings || {};
        for (var property in extraSettings) {
            this[property] = extraSettings[property];
        }
        this.format = this.format || 'json';
        this.callbackparameter = this.callbackparameter || "callback";
        this.embedtag = this.embedtag || {tag: ""};
    };

    /*
     * Function to update existing providers
     *
     * @param  {String}    name             The name of the provider
     * @param  {String}    type             The type of the provider can be "file", "photo", "video", "rich"
     * @param  {String}    urlshemesarray   Array of url of the provider
     * @param  {String}    apiendpoint      The endpoint of the provider
     * @param  {String}    extraSettings    Extra settings of the provider
     */
    $.fn.updateOEmbedProvider = function (name, type, urlschemesarray, apiendpoint, extraSettings) {
        for (var i = 0; i < $.fn.oembed.providers.length; i++) {
            if ($.fn.oembed.providers[i].name === name) {
                if (type !== null) {
                    $.fn.oembed.providers[i].type = type;
                }
                if (urlschemesarray !== null) {
                    $.fn.oembed.providers[i].urlschemes = urlschemesarray;
                }
                if (apiendpoint !== null) {
                    $.fn.oembed.providers[i].apiendpoint = apiendpoint;
                }
                if (extraSettings !== null) {
                    $.fn.oembed.providers[i].extraSettings = extraSettings;
                    for (var property in extraSettings) {
                        if (property !== null && extraSettings[property] !== null) {
                            $.fn.oembed.providers[i][property] = extraSettings[property];
                        }
                    }
                }
            }
        }
    };

    /* Native & common providers */
    $.fn.oembed.providers = [

        //Video
        new $.fn.oembed.OEmbedProvider("youtube", "video", ["youtube\\.com/watch.+v=[\\w-]+&?", "youtu\\.be/[\\w-]+", "youtube.com/embed"], '//www.youtube.com/embed/$1?wmode=transparent', {
            templateRegex: /.*(?:v=|be\/|embed\/)([\w-]+)&?.*/, embedtag: {tag: 'iframe'}
        }),
        new $.fn.oembed.OEmbedProvider("funnyordie", "video", ["funnyordie\\.com/videos/.+"], '//www.funnyordie.com/embed/$1', {
            templateRegex: /.*videos\/([^/]+)\/([^/]+)?/, embedtag: {tag:'iframe', width: '300', height: '200'}, nocache: true}),
        new $.fn.oembed.OEmbedProvider("blip", "video", ["blip\\.tv/.+"], "https://blip.tv/oembed/"),
        new $.fn.oembed.OEmbedProvider("hulu", "video", ["hulu\\.com/watch/.*"], "https://www.hulu.com/api/oembed.json"),
        new $.fn.oembed.OEmbedProvider("vimeo", "video", ["www.vimeo.com/groups/.*/videos/.*", "www.vimeo.com/.*", "vimeo.com/groups/.*/videos/.*", "vimeo.com/.*"], "https://vimeo.com/api/oembed.json"),
        new $.fn.oembed.OEmbedProvider("dailymotion", "video", ["dailymotion\\.com/.+"], '//www.dailymotion.com/services/oembed'),
        new $.fn.oembed.OEmbedProvider("vine", "video", ["vine.co/v/.*"], null,
            {
                templateRegex: /https?:\/\/w?w?w?.?vine\.co\/v\/([a-zA-Z0-9]*).*/,
                template: '<iframe src="https://vine.co/v/$1/embed/postcard" width="600" height="600" allowfullscreen="true" allowscriptaccess="always" scrolling="no" frameborder="0"></iframe>' +
                    '<script async src="https://platform.vine.co/static/scripts/embed.js" charset="utf-8"></script>',
                nocache: 1
            }),

        //Audio
        new $.fn.oembed.OEmbedProvider("Spotify", "rich", ["open.spotify.com/(track|album|user)/"], "https://embed.spotify.com/oembed/"),
        new $.fn.oembed.OEmbedProvider("Soundcloud", "rich", ["soundcloud.com/.+", "snd.sc/.+"], "https://soundcloud.com/oembed", {format: 'js'}),

        //Photo
        new $.fn.oembed.OEmbedProvider("deviantart", "photo", ["deviantart.com/.+", "fav.me/.+", "deviantart.com/.+"], "https://backend.deviantart.com/oembed", {format: 'jsonp'}),
        new $.fn.oembed.OEmbedProvider("flickr", "photo", ["flickr\\.com/photos/.+"], "https://flickr.com/services/oembed", {callbackparameter: 'jsoncallback'}),
        new $.fn.oembed.OEmbedProvider("instagram", "photo", ["instagr\\.?am(\\.com)?/.+"], "https://api.instagram.com/oembed"),
        new $.fn.oembed.OEmbedProvider("circuitlab", "photo", ["circuitlab.com/circuit/.+"], "https://www.circuitlab.com/circuit/$1/screenshot/540x405/",
            {templateRegex: /.*circuit\/([^/]+).*/, embedtag: {tag: 'img'}, nocache: 1}),
        new $.fn.oembed.OEmbedProvider("img.ly", "photo", ["img\\.ly/.+"], "https://img.ly/show/thumb/$1",
            {templateRegex: /.*ly\/([^/]+).*/, embedtag: {tag: 'img'}, nocache: 1}),
        new $.fn.oembed.OEmbedProvider("imgur.com", "photo", ["imgur\\.com/gallery/.+"], "https://imgur.com/$1l.jpg",
            {templateRegex: /.*gallery\/([^/]+).*/, embedtag: {tag: 'img'}, nocache: 1}),

        //Rich
        new $.fn.oembed.OEmbedProvider("twitter", "rich", ["twitter.com/.+"], "https://publish.twitter.com/oembed"),
        new $.fn.oembed.OEmbedProvider("documentcloud", "rich", ["documentcloud.org/documents/.+"], "https://www.documentcloud.org/api/oembed.json"),
        new $.fn.oembed.OEmbedProvider("meetup", "rich", ["meetup\\.(com|ps)/.+"], "https://api.meetup.com/oembed"),
        new $.fn.oembed.OEmbedProvider("wikipedia", "rich", ["wikipedia.org/wiki/.+"],
            "https://$1.wikipedia.org/w/api.php?action=parse&page=$2&format=json&section=0&prop=text|displaytitle&callback=?", {
                templateRegex: /.*\/\/([\w]+).*\/wiki\/([^/]+).*/,
                templateData: function (data) {
                    if (!data.parse)
                        return false;
                    const title = data.parse.displaytitle;
                    const $page = $(data.parse.text['*'].replace(/href="\//g, 'href="https://en.wikipedia.org/'));
                    $page.find('.mw-references-wrap').remove();
                    return [
                        `<h4>Wikipedia - <a class="nav-link" href="https://en.wikipedia.org/wiki/${title}">`,
                            data.parse.title,
                        `</a></h4>`,
                        `<div class="wikipedia page">${$page.html()}</div>`
                    ].join('');
                }
            }),
        new $.fn.oembed.OEmbedProvider("jsfiddle", "rich", ["jsfiddle.net/.+"], "https://jsfiddle.net/$1/$2/embedded/js,resources,html,css/?",
            {templateRegex: /.*net\/([^/]+)\/([^/]+)\/?.*/, embedtag: {tag: 'iframe', width: '100%', height: '300' }}),
        new $.fn.oembed.OEmbedProvider("jsbin", "rich", ["jsbin.com/.+"], "https://jsbin.com/$1/?",
            {templateRegex: /.*com\/([^/]+).*/, embedtag: {tag: 'iframe', width: '100%', height: '300' }}),
        new $.fn.oembed.OEmbedProvider("jotform", "rich", ["form.jotform.co/form/.+"], "$1?",
            {templateRegex: /(.*)/, embedtag: {tag: 'iframe', width: '100%', height: '507' }}),
        new $.fn.oembed.OEmbedProvider("linkedin", "rich", ["linkedin.com/pub/.+"], "https://www.linkedin.com/cws/member/public_profile?public_profile_url=$1&format=inline&isFramed=true",
            {templateRegex: /(.*)/, embedtag: {tag: 'iframe', width: '368px', height: 'auto'}}),
        new $.fn.oembed.OEmbedProvider("pastebin", "rich", ["pastebin\\.com/[\\S]{8}"], "https://pastebin.com/embed_iframe.php?i=$1",
            {templateRegex: /.*\/(\S{8}).*/, embedtag: {tag: 'iframe', width: '100%', height: 'auto'}}),
        new $.fn.oembed.OEmbedProvider("github", "rich", ["gist.github.com/.+"], "https://github.com/api/oembed"),
        new $.fn.oembed.OEmbedProvider("github", "rich", ["github.com/[-.\\w@]+/[-.\\w@]+"], "https://api.github.com/repos/$1/$2?callback=?"
            , {templateRegex: /.*\/([^/]+)\/([^/]+).*/,
                templateData: function (data) {
                    if (!data.data.html_url)return false;
                    return  '<div class="oembedall-githubrepos"><ul class="oembedall-repo-stats"><li>' + data.data.language + '</li><li class="oembedall-watchers"><a title="Watchers" href="' + data.data.html_url + '/watchers">&#x25c9; ' + data.data.watchers + '</a></li>'
                        + '<li class="oembedall-forks"><a title="Forks" href="' + data.data.html_url + '/network">&#x0265; ' + data.data.forks + '</a></li></ul><h3><a href="' + data.data.html_url + '">' + data.data.name + '</a></h3><div class="oembedall-body"><p class="oembedall-description">' + data.data.description + '</p>'
                        + '<p class="oembedall-updated-at">Last updated: ' + data.data.pushed_at + '</p></div></div>';
                }
            }),
        new $.fn.oembed.OEmbedProvider("stackexchange", "rich", ["stackoverflow.com/questions/[\\d]+"],
                                       "https://api.stackexchange.com/2.2/questions/$1?site=stackoverflow.com&callback=?", {
            templateRegex: /.*questions\/([\d]+).*/,
            templateData: function (data) {
                if (!data.items)
                    return false;
                const q = data.items[0];
                return [
                    `<div class="oembedall-stoqembed">`,
                        `<div class="oembedall-statscontainer">`,
                            `<div class="oembedall-stats">`,
                                `<div class="oe-box oe-votes">`,
                                    `<div class="oe-score">${q.score}</div>`,
                                    `<div class="oe-label">upvote(s)</div>`,
                                `</div>`,
                                `<div class="oe-box oe-status">`,
                                    `<strong>${q.answer_count}</strong>`,
                                    `<div class="oe-label">answer(s)</div>`,
                                `</div>`,
                            `</div>`,
                            `<div class="oembedall-views">${q.view_count} view(s)</div>`,
                        `</div>`,
                        `<div class="oembedall-summary">`,
                            `<a class="oembedall-question-hyperlink" href="https://stackoverflow.com/questions/${q.question_id}/">${q.title}</a>`,
                            `<div class="oembedall-tags">`,
                                q.tags.map(x => `<a class="oembedall-post-tag" href="https://stackoverflow.com/questions/tagged/${x}">${x}</a>`).join(''),
                            `</div>`,
                        `</div>`,
                        `<div class="oembedall-user-info">`,
                            `<a class="oe-gravatar" title="Asked by ${q.owner.display_name}"`,
                               `href="https://stackoverflow.com/users/${q.owner.user_id}/${q.owner.display_name}">`,
                                `<img width="32" height="32" src="https://www.gravatar.com/avatar/${q.owner.email_hash}?s=32&d=identicon"/>`,
                            `</a>`,
                        `</div>`,
                    `</div>`
                ].join('');
            }
        }),
        new $.fn.oembed.OEmbedProvider("kickstarter", "rich", ["kickstarter\\.com/projects/.+"], "$1/widget/card.html",
            {templateRegex: /([^?]+).*/, embedtag: {tag: 'iframe', width: '220', height: 380}}),
        new $.fn.oembed.OEmbedProvider("amazon", "rich", ["amzn.com/B+", "amazon.com.*/(B\\S+)($|\\/.*)"], "https://ws-na.amazon-adsystem.com/widgets/q?ServiceVersion=20070822&OneJS=1&Operation=GetAdHtml&MarketPlace=US&source=ac&ref=tf_til&ad_type=product_link&tracking_id=_APIKEY_&marketplace=amazon&region=US&asins=$1&show_border=false",
            {
                apikey: true,
                templateRegex: /.*\/(B[0-9A-Z]+)($|\/.*)/,
                embedtag: {
                    tag: 'iframe',
                    width: '120px',
                    height: '240px'}
            }),
        new $.fn.oembed.OEmbedProvider("slideshare", "rich", ["slideshare.net"], "https://www.slideshare.net/api/oembed/2", {format: 'jsonp'}),
        new $.fn.oembed.OEmbedProvider("coveritlive", "rich", ["coveritlive.com/"], null, {
            templateRegex: /(.*)/,
            template: '<iframe src="$1" allowtransparency="true" scrolling="no" width="615px" frameborder="0" height="625px"></iframe>'}),
        new $.fn.oembed.OEmbedProvider("googleviews", "rich", ["(.*maps\\.google\\.com\\/maps\\?).+(output=svembed).+(cbp=(.*)).*"], "https://maps.google.com/maps?layer=c&panoid=$3&ie=UTF8&source=embed&output=svembed&cbp=$5", {templateRegex: /(.*maps\.google\.com\/maps\?).+(panoid=(\w+)&).*(cbp=(.*)).*/, embedtag: {tag: 'iframe', width: 480, height: 360}, nocache: 1 }),
        new $.fn.oembed.OEmbedProvider("googlemaps", "rich", ["google\\.com/maps/place/.+"], "https://maps.google.com/maps?t=m&q=$1&output=embed", {templateRegex: /.*google\.com\/maps\/place\/([\w+]*)\/.*/, embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
        new $.fn.oembed.OEmbedProvider("ponga", "rich", ["ponga\\.com/.+"], "https://www.ponga.com/embedded?id=$1", {templateRegex: [/.*ponga\.com\/embedded\?id=(\w+).*/, /.*ponga\.com\/(\w+).*/], embedtag: {tag: 'iframe', width: 480, height: 360 }, nocache: 1}),
        new $.fn.oembed.OEmbedProvider("xkcd", "rich", ["xkcd\\.com/.+"], "https://xkcd.now.sh/$1", {
            method: 'fetch',
            templateRegex: /.*xkcd\.com\/([0-9]+)\/?.*/,
            templateData: data => `<img src="${data.img}" title="${data.alt}" style="max-width: 100%"/>`
        }),
    ];
})(self.$);
