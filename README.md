Jquery-Oembed-All
=================

This is a fork (with a lot of changes) of the jquery-oembed located at http://code.google.com/p/jquery-oembed/.

Instead of using oohembed or other such services it tries to embed the object natively without having to use some kind of local server.
This project will happily use native oembed services when it can, however it also use other types of embedding whenever oembed is not possible.

Over time I'll be removing the some providers that have been hardcoded and using OGP instead to provide a standard embed layout and reduce the file size.

This project tries to use embedding techniques in the following order of preference:

* oEmbed - JSONP available - e.g.  flickr, meetup etc
* embedding (IFRAME/Object) based on URL information - e.g.  youtube
* JSONP Api lookups Source - With HTML and CSS built in this project - e.g. github, Myspace, Facebook

Quick Start
-----------
Add this to your javascript file.
````
$(function(){
   $("a.embed").oembed();
});
````

Add `class="embed"` to anchor tag which contains the URL you wish to embed.  
Ex: `<a href="http://www.youtube.com/watch?v=8mwKq7_JlS8" class="embed"></a>`

Shortened Urls
------------
This project now handles shortened url's using the JSONP service from http://longurl.org. e.g. http://bit.ly/oP77mm will first lengthen the URL 
to http://tinychat.com/omginternetparty and then embed as normal. This is experimental - so let me know of problems!

to use...
````
<a href="https://github.com/starfishmod/jquery-oembed-all" class="oembed">https://github.com/starfishmod/jquery-oembed-all</a>
````

1. url 
2. options

````
$(".oembed").oembed(null,{
    embedMethod: 'auto',	// "auto", "append", "fill"	
    apikeys: {
      amazon : '<your amazon key>',
    }
});
````

````
$(".oembed").oembed(null,{
        fallback : false
    }
});
````
