// jQuery Super Sticky Plugin
// version 1.0.1, June 14, 2013
// by Jason Rosenbaum, Corporate Action Network, seminal@theseminal.com

// A smooth sticky plugin that keeps an element stuck onscreen no matter how far the user scrolls. 
// Handles edge cases well (like elements that are longer than browser windows, or that change height after load).

// Copyright (c) 2013 Jason Rosenbaum
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// Usage
//
//		options:
//			wrapper	-- a jQuery selector identifying the element that wraps around the sticky sidebar (default: the sticky element's parent)
//			padding_top -- the amount of padding you want the sticky sidebar to maintain from the top of the browser window, in pixels (default: 0)
//			padding_bottom -- the amount of padding you want the sticky sidebar to maintain from the bottom of the wrapper element, in pixels (default: 0)
//
//		methods:
//			none
//
//		example:
//			$(document).ready(function() {
//				$('.sticky_element').superSticky({
//					padding_top : 120,
//					padding_bottom : 50,
//					wrapper: '.action_page'
//				});
//			});


(function($) {

    // here it goes!
    $.fn.superSticky = function(method) {

        // public methods
        // to keep the $.fn namespace uncluttered, collect all of the plugin's methods in an object literal and call
        // them by passing the string name of the method to the plugin
        //
        // public methods can be called as
        // element.pluginName('methodName', arg1, arg2, ... argn)
        // where "element" is the element the plugin is attached to, "pluginName" is the name of your plugin and
        // "methodName" is the name of a function available in the "methods" object below; arg1 ... argn are arguments
        // to be passed to the method
        //
        // or, from inside the plugin:
        // methods.methodName(arg1, arg2, ... argn)
        // where "methodName" is the name of a function available in the "methods" object below
        var methods = {

            // this the constructor method that gets called when the object is created
            init : function(options) {
            	//console.log('init');

                // the plugin's final properties are the merged default and user-provided properties (if any)
                // this has the advantage of not polluting the defaults, making them re-usable 
                this.superSticky.settings = $.extend({}, this.superSticky.defaults, options);

                // iterate through all the DOM elements we are attaching the plugin to
                return this.each(function() {
                
                	

                    var $element = $(this), // reference to the jQuery version of the current DOM element
                        element = this;     // reference to the actual DOM element
                    
                    if (typeof($element.superSticky.settings.wrapper) === 'undefined') {
	                	var $wrapper = $element.parent();
	                } else {
		                var $wrapper = $($element.superSticky.settings.wrapper),
	                		wrapper = $element.superSticky.settings.wrapper;
	                }
	                
	                //set some important values on init, before scrolling starts
	                var initialValues = {
		                'targetInitialPosition' 		: $element.css('position'),
	                    'targetInitialTop'				: $element.css('top'),
	                    'targetInitialTopOffset'		: $element.offset().top,
	                    'targetInitialWrapperOffset'	: $element.offset().top - $wrapper.offset().top,
	                    'pageScrollElementBottomFlag'	: false,
	                    'lastScrollTop'					: 0,
	                    'freezePositionFlag'			: false,
	                    'targetInitialLeftOffset'		: $element.offset().left
	                };
	                
	                console.log(initialValues.targetInitialPosition);
	                
	                initialValues.targetInitialPosition = 'static';
	                
	                if ($element.superSticky.settings.padding_top > initialValues.targetInitialTopOffset) {
	                	$element.superSticky.settings.padding_top = initialValues.targetInitialTopOffset;
	                }

                    // call the scroll function on load
                    helpers.scroll(element, initialValues);
                      
                    // call the scroll function on scroll 
                    $(window).scroll(function() {
			    		helpers.scroll(element, initialValues);
			    	});
			    	
			    	//mutate event call to detect change in target's height
	                $element.mutate('height',function (){
	                	helpers.scroll(element, initialValues);
	                });
	                
	                $wrapper.mutate('height',function (){
	                	helpers.scroll(element, initialValues);
	                	console.log('wrapper height change');
	                });

                });
                
                

            },

        }

        // private methods
        // these methods can be called only from inside the plugin
        //
        // private methods can be called as
        // helpers.methodName(arg1, arg2, ... argn)
        // where "methodName" is the name of a function available in the "helpers" object below; arg1 ... argn are
        // arguments to be passed to the method
        var helpers = {

            // a private method.
            scroll: function(target, values) {
            	
            	var $element = $(target), // reference to the jQuery version of the current DOM element
                    element = target;     // reference to the actual DOM element
                    
                if (typeof($element.superSticky.settings.wrapper) === 'undefined') {
                	var $wrapper = $element.parent();
                } else {
	                var $wrapper = $($element.superSticky.settings.wrapper),
                		wrapper = $element.superSticky.settings.wrapper;
                }
                
                //console.log($element);
                //console.log($wrapper);
            
                //add values that change on scroll to the values object
                values.scrollPosition = $(window).scrollTop();
                values.targetPosition = $element.offset().top;
                values.windowHeight = $(window).outerHeight();
                values.targetHeight	= $element.outerHeight();
                values.wrapperHeight = $wrapper.outerHeight();
	            values.wrapperPosition = $wrapper.offset().top;
                
                var pageTop = function() { //we're at the top of the page, so element goes back to its initial state
	                //$element.css('background-color','white');
                	$element.css('position', values.targetInitialPosition);
                	$element.css('top', values.targetInitialTop);
                	$element.css('left', 'auto');
                },
                pageBottom = function() { //we're at the bottom of the page, so element stays within its wrapper
	                //$element.css('background-color','pink');
	                $element.css('position','relative');
	                $element.css('top', values.wrapperHeight - $element.superSticky.settings.padding_bottom - values.targetInitialWrapperOffset - values.targetHeight);
	                $element.css('left', 'auto');
                },
                pageScroll = function() { //we're in the middle/top and scrolling, so element stays stuck to screen
	                //$element.css('background-color','red');
	                $element.css('position','fixed');
	                $element.css('top', $element.superSticky.settings.padding_top);
	                values.freezePositionFlag = false;
	                $element.css('left', values.targetInitialLeftOffset);
                },
                pageScrollElementBottom = function() { //we're at the bottom of the element if the element is bigger than the browser window
	                //$element.css('background-color','blue');
	                $element.css('position','fixed');
	                $element.css('top', (values.windowHeight - (values.targetHeight + $element.superSticky.settings.padding_bottom)));
	                values.freezePositionFlag = false;
	                $element.css('left', values.targetInitialLeftOffset);
                },
                pageScrollElementMiddle = function() { //if we're in the middle of an element that's longer than the page
	                //$element.css('background-color','cyan');
	                $element.css('position','relative');
	                if (!values.freezePositionFlag) {
		                values.freezePositionFlag = values.targetPosition - values.targetInitialTopOffset;
		                $element.css('top', values.freezePositionFlag);
		                $element.css('left', 'auto');
	                }
	                
                },
                initialReset = function() {
	                $element.css('position',values.targetInitialPosition);
	                $element.css('top', values.targetInitialTop);
	                $element.css('left', 'auto');
                }
                
                //here's the heart: logic statements to call the right function based on the right scroll situation
                if (values.targetInitialTopOffset + $element.superSticky.settings.padding_bottom + values.targetHeight - values.wrapperPosition < values.wrapperHeight){ //if the sidebar is shorter than its wrapper, and therefore should be sticky at all...
	                if (values.scrollPosition <= values.targetInitialTopOffset - $element.superSticky.settings.padding_top) { //detect top of page
                	
	                	pageTop();
	                
	                } else { // if we're not at the top of the page
	                	if (values.windowHeight <= values.targetHeight + $element.superSticky.settings.padding_top + $element.superSticky.settings.padding_bottom) { //if the sticky element is larger than the browser window...
	                		
	                		
	                		//$element.css('border','1px solid red');
	                		if (values.scrollPosition + values.targetHeight - ((values.targetHeight + $element.superSticky.settings.padding_bottom) - values.windowHeight) >= values.wrapperHeight + values.wrapperPosition - $element.superSticky.settings.padding_bottom) { //detect bottom of page for element bigger than window
	                			
	                			pageBottom();
	                		
	                		} else { //if we're not at the top or the bottom, we're in the middle and scrolling
	                			if (values.scrollPosition > values.lastScrollTop) { //if we're scrolling down
			                		if (values.scrollPosition >= values.targetPosition + ((values.targetHeight + $element.superSticky.settings.padding_bottom) - values.windowHeight)) { //if we've scrolled to the bottom of the element that's larger than the window, freeze it onscreen
				                		
				                		values.pageScrollElementBottomFlag = true;
				                		pageScrollElementBottom();
				                	
				                	} else { // otherwise, we're in the middle, so freeze the element
					                	
					                	pageScrollElementMiddle();
					                	
				                	}
				                }  else {  //if we're scrolling up
				                	if (values.scrollPosition <= values.targetPosition - $element.superSticky.settings.padding_top && values.pageScrollElementBottomFlag) { // if we're at the top of the element...
					                	
					                	pageScroll();
					                	
					                } else { // if we're in the middle of the element...
					                	
					                	pageScrollElementMiddle();
					                	
					                }
					            }
				                
			                }
			                
			                values.lastScrollTop = values.scrollPosition;
			                
	                	} else { //if the sticky element is smaller than the browser window...
	                		//$element.css('border','1px solid blue');
		                	if (values.scrollPosition + values.targetHeight + $element.superSticky.settings.padding_top >= values.wrapperHeight + values.wrapperPosition - $element.superSticky.settings.padding_bottom) { //detect bottom of page for element smaller than window
			                	
			                	pageBottom();
			                
			                } else { //if we're not at the top or the bottom, we're in the middle and scrolling
	                			
	                			pageScroll();
	                		
	                		}
	                	}
	                }
	            } else {
		            initialReset();
	            }
	        }
        }
                

        // if a method as the given argument exists
        if (methods[method]) {

            // call the respective method
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));

        // if an object is given as method OR nothing is given as argument
        } else if (typeof method === 'object' || !method) {

            // call the initialization method
            return methods.init.apply(this, arguments);

        // otherwise
        } else {

            // trigger an error
            $.error( 'Method "' +  method + '" does not exist in the superSticky plugin!');

        }

    }

    // plugin's default options
    $.fn.superSticky.defaults = {

        padding_top		: 0,
        padding_bottom	: 0
        //note: wrapper setting doesn't have a default that's set here, but rather it's set above on init -- default is the sticky element's parent

    }

    // this will hold the merged default and user-provided options
    // you will have access to these options like:
    // this.superSticky.settings.propertyName from inside the plugin or
    // element.superSticky.settings.propertyName from outside the plugin, where "element" is the element the
    // plugin is attached to;
    $.fn.superSticky.settings = {}

})(jQuery);

//jQuery mutate plugin to detect dynamic changes in target's height
mutate_event_stack = [  
    {
        name: 'width',
        handler: function (elem){
            n = {el:elem}
            if(!$(n.el).data('mutate-width'))$(n.el).data('mutate-width', $(n.el).width());
            if ($(n.el).data('mutate-width')&&$(n.el).width() != $(n.el).data('mutate-width')  ) {
                $(n.el).data('mutate-width', $(n.el).width());
                return true;
            }
            return false;
        }
    },
    {
        name:'height',
        handler: function (n){
            element = n;
            if(!$(element).data('mutate-height'))$(element).data('mutate-height', $(element).height());
            if ($(element).data('mutate-height')&&$(element).height() != $(element).data('mutate-height')  ) {
                $(element).data('mutate-height', $(element).height());
                return true;
            }
        }
    },
    {
        name        : 'top',
        handler     : function (n){
            if(!$(n).data('mutate-top'))$(n).data('mutate-top', $(n).css('top'));
            if ($(n).data('mutate-top')&&$(n).css('top') != $(n).data('mutate-top')  ) {
                $(n).data('mutate-top', $(n).css('top'));
                return true;
            }
        }
    },
    {
        name        : 'bottom',
        handler     : function (n){
            if(!$(n).data('mutate-bottom'))$(n).data('mutate-bottom', $(n).css('bottom'));
            if ($(n).data('mutate-bottom')&&$(n).css('bottom') != $(n).data('mutate-bottom')  ) {
                $(n).data('mutate-bottom', $(n).css('bottom'));
                return true;
            }
        }
    },
    {
        name        : 'right',
        handler     : function (n){
            if(!$(n).data('mutate-right'))$(n).data('mutate-right', $(n).css('right'));
            if ($(n).data('mutate-right')&&$(n).css('right') != $(n).data('mutate-right')  ) {
                $(n).data('mutate-right', $(n).css('right'));
                return true;
            }
        }
    },
    {
        name        : 'left',
        handler     : function (n){
            if(!$(n).data('mutate-left'))$(n).data('mutate-left', $(n).css('left'));
            if ($(n).data('mutate-left')&&$(n).css('left') != $(n).data('mutate-left')  ) {
                $(n).data('mutate-left', $(n).css('left'));
                return true;
            }
        }
    },
    {
        name        : 'hide',
        handler     : function (n){ if ($(n).is(':hidden')) return true; }
    },
    {
        name        : 'show',
        handler     : function (n){ if ($(n).is(':visible'))    return true; }
    },
    {
        name        : 'scrollHeight',
        handler     : function (n){
            if(!$(n).data('prev-scrollHeight'))$(n).data('prev-scrollHeight', $(n)[0].scrollHeight);
            if ($(n).data('prev-scrollHeight')&&$(n)[0].scrollHeight != $(n).data('prev-scrollHeight')  ) {
                $(n).data('prev-scrollHeight', $(n)[0].scrollHeight);
                return true;
            }
        }
    },
    {
        name        : 'scrollWidth',
        handler     : function (n){
            if(!$(n).data('prev-scrollWidth'))$(n).data('prev-scrollWidth', $(n)[0].scrollWidth);
            if ($(n).data('prev-scrollWidth')&&$(n)[0].scrollWidth != $(n).data('prev-scrollWidth')  ) {
                $(n).data('prev-scrollWidth', $(n)[0].scrollWidth);
                return true;
            }
        }
    },
    {
        name        : 'scrollTop',
        handler     : function (n){
            if(!$(n).data('prev-scrollTop'))$(n).data('prev-scrollTop', $(n)[0].scrollTop());
            if ($(n).data('prev-scrollTop')&&$(n)[0].scrollTop() != $(n).data('prev-scrollTop')  ) {
                $(n).data('prev-scrollTop', $(n)[0].scrollTop());
                return true;
            }
        }
    },
    {
        name        : 'scrollLeft',
        handler     : function (n){
            if(!$(n).data('prev-scrollLeft'))$(n).data('prev-scrollLeft', $(n)[0].scrollLeft());
            if ($(n).data('prev-scrollLeft')&&$(n)[0].scrollLeft() != $(n).data('prev-scrollLeft')  ) {
                $(n).data('prev-scrollLeft', $(n)[0].scrollLeft());
                return true;
            }
        }
    }
];

(function($){mutate={speed:1,event_stack:mutate_event_stack,stack:[],events:{},add_event:function(evt){mutate.events[evt.name]=evt.handler;},add:function(event_name,selector,callback,false_callback){mutate.stack[mutate.stack.length]={event_name:event_name,selector:selector,callback:callback,false_callback:false_callback}}};function reset(){var parent=mutate;if(parent.event_stack!='undefined'&&parent.event_stack.length){$.each(parent.event_stack,function(j,k){mutate.add_event(k);});}
parent.event_stack=[];$.each(parent.stack,function(i,n){$(n.selector).each(function(a,b){if(parent.events[n.event_name](b)===true){if(n['callback'])n.callback(b,n);}else{if(n['false_callback'])n.false_callback(b,n)}})})  
setTimeout(reset,mutate.speed);}  
reset();$.fn.extend({mutate:function(){var event_name=false,callback=arguments[1],selector=this,false_callback=arguments[2]?arguments[2]:function(){};if(arguments[0].toLowerCase()=='extend'){mutate.add_event(callback);return this;}  
$.each($.trim(arguments[0]).split(' '),function(i,n){event_name=n;mutate.add(event_name,selector,callback,false_callback);});return this;}});})(jQuery);