(function($, obviel) {

  var od = window.opendebate = {};

  od.init = function(question_page, vote_page, votecheck_page,
                     question_proxy, vote_proxy,
                     recognized_user_callback, 
                     submit_question_fetcher,
                     question_submitted_callback,
                     vote_user_data_fetcher,
                     vote_submitted_callback) {

    $(window).on("hashchange", function(e) {
      window.location.hash && ga("send", "pageview", window.location.hash.substr(1));
      od.render();
    });
    $(".tweet-button .twitter").on("click", function() {
        ga("send", "event", "share", "tweet", $(this).data("question"));
    });
    $(".fb-button .facebook").on("click", function() {
        ga("send", "event", "share", "facebook", $(this).data("question"));
    });

    od.pages = {};
    od.pages.question = question_page;
    od.pages.vote = vote_page;
    od.pages.votecheck = votecheck_page;
    od.data_proxies = {};
    od.data_proxies.question = question_proxy;
    od.data_proxies.vote = vote_proxy;

    od.recognized_user_callback = recognized_user_callback;
    od.submit_question_fetcher = submit_question_fetcher;
    od.question_submitted_callback = question_submitted_callback;
    od.vote_user_data_fetcher = vote_user_data_fetcher;
    od.vote_submitted_callback = vote_submitted_callback;

    od.setAkid();

    var map = od.map = L.map('map', {"maxZoom": 12}).setView([42.447222, -71.225], 10);
    L.tileLayer('http://{s}.tile.cloudmade.com/08b509de1e88474f986310c40caf2dc2/997/256/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
      maxZoom: 18
    }).addTo(map);
    od.map_layer = L.markerClusterGroup().addTo(map);
    map.invalidateSize();
    map.on("popupopen", function(e) {
      var contents = $(e.popup._container).find("#map_popup").get(0);
      contents && FB.XFBML.parse(contents);
    });

    od.data = null;
    od.votes = null;
    od.dataSort = null;

    od.fetchQuestions();
    od.fetchVotes();

    window.location.hash && ga("send", "pageview", window.location.hash.substr(1));
  };

  od.unsetAkid = function() {
    od.akid = null;
    od.recognized_user = null;
    $("#recognized_user").empty();
    $.cookie("pccc.akid", "", { path: '/', expires: -5 });
    $.cookie("pccc.email", "", { path: '/', expires: -5 });
    $.cookie("pccc.zip", "", { path: '/', expires: -5 });

    od.recognized_user_callback && od.recognized_user_callback(false);

  };
  od.setAkid = function(akid) {
    if( !akid ) {
      akid = window.location.search.match(/akid=(.*\.\d+\.[\d\w-]+)/);
      if( akid ) akid = akid[1];
    }
    if( !akid ) {
      akid = $.cookie("pccc.akid");
    }
    if( akid ) {
               $.ajax({
                   type: 'GET',
                   url: "//act.boldprogressives.org/cms/thanks/" + od.pages.votecheck + "?checkAkid=yes&akid=" + akid + "&template_set=(TEST)%20Magic%20Actionfield%20Stuff",
                   async: false,
                   jsonp: "jsonp",
                   contentType: "application/json",
                   dataType: 'jsonp',
                   success: od.processOneFetchedVoter
               });
    }
  };

  od.processUserRecognition = function(valid, user) {
      if( !valid ) {
          od.unsetAkid();
          return false;
      }

      $.cookie("pccc.akid", user.akid, {expires: 7, path: "/"});
      $.cookie("pccc.email", user.email, {expires: 7, path: "/"});
      $.cookie("pccc.zip", user.zip, {expires: 7, path: "/"});
      $.cookie("pccc.first_name", user.first_name, {expires: 7, path: "/"});
      $.cookie("pccc.last_name", user.last_name, {expires: 7, path: "/"});
      od.akid = user.akid;
      od.recognized_user = {
          iface: "recognized_user",
          akid: user.akid,
          email: user.email,
          zip: user.zip,
          first_name: user.first_name,
          last_name: user.last_name
      };
      od.recognized_user.best_name = (user.first_name && user.last_name) ? (user.first_name + " " + user.last_name) : user.email;
      $("#recognized_user").render(od.recognized_user);
      od.recognized_user_callback && od.recognized_user_callback(true, od.recognized_user);
  };

  od.refresh = function(view) {
    od.map.invalidateSize();
    FB.XFBML.parse();
  };

  od.submitVote = function(question_id, akid, user_id) {
    var votes = od.getVotesForUser(user_id);
    if( votes.indexOf(question_id) == -1 ) {
      votes.push(question_id);
    }
  
    submitActionkitForm(od.pages.vote, {
        "akid": akid,
        "action_vote": votes,
        "status": "complete"
        }, function(result, data) {
             if( result == "success" ) {
               ga("send", "event", "vote", "complete", question_id, 
                  (od.votes[parseInt(question_id)] || []).length);

               var thanks_redirect = data;
               $.ajax({
                   type: 'GET',
                   url: "//act.boldprogressives.org" + thanks_redirect + "&template_set=(TEST)%20Magic%20Actionfield%20Stuff",
                   async: false,
                   jsonp: "jsonp",
                   contentType: "application/json",
                   dataType: 'jsonp',
                   success: od.processOneFetchedVoter
               });
               od.vote_submitted_callback("success", 
                                          {akid: akid, question_id: question_id});
               window.location.hash = "#/question/" + question_id + "/";

             } else {
               ga("send", "event", "vote", "error", question_id, 
                  (od.votes[parseInt(question_id)] || []).length);
               console.log("Errors: " + JSON.stringify(data));
             }
        });
  };
    
  var datetime_formatter = function(gmt) {
      var zeroPadded = function(n) {
          return n < 10 ? "0" + n : "" + n;
      };
         
      var formatDate = function(datestring) {
          var last_updated = new Date(datestring) // e.g. "Feb. 13, 2013, 03:39:14 AM", assumed to be UTC
          var months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.",
                        "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
          last_updated = months[last_updated.getMonth()] + " " + last_updated.getDate()
              + ", " + (last_updated.getYear() + 1900) + ", "
              + (last_updated.getHours() > 12 ? last_updated.getHours() - 12 : last_updated.getHours()) 
              + ":" + zeroPadded(last_updated.getMinutes())
              + (last_updated.getHours() > 11 ? " PM" : " AM");
          return last_updated;
      };

      var localeTime = formatDate(gmt);
      return humaneDate(localeTime) || localeTime;
  };

  obviel.template.registerFormatter('datetime', datetime_formatter);
  Handlebars.registerHelper("datetime", datetime_formatter);

  od.submitQuestion = function() {
    ga("send", "event", "question", "submit");

    var data = od.submit_question_fetcher();
    if( data === false ) {
      return false;
    }

    submitActionkitForm(od.pages.question, data, function(result, data) {
	  
      if( result === "success" ) {
        ga("send", "event", "question", "submit_final");
        var akid = data.match(/akid=(\.\d+\.[\d\w\-_]+)&/);
        var question_id = data.match(/action_id=(\d+)/);
	if( question_id && question_id.length ) { question_id = question_id[1]; }
	if( !question_id ) throw "Could not extract question ID!"
        if( akid && akid.length ) {
          akid = akid[1];
          var user_id = parseInt(akid.split(".")[1]);
          od.setAkid(akid);
        }

        var thanks_redirect = data;
        $.ajax({
          type: 'GET',
          url: "//act.boldprogressives.org" + thanks_redirect + "&template_set=(TEST)%20Magic%20Actionfield%20Stuff",
          async: false,
          jsonp: "jsonp",
          contentType: "application/json",
          dataType: 'jsonp',
          success: od.processOneFetchedQuestion
        });

        od.question_submitted_callback("success", {question_id: question_id,
                                                   akid: akid});
      } else {
        ga("send", "event", "question", "submit_error");
        od.question_submitted_callback(result, data);
      }
      return false;
    });
  };

	

  od.vote = function(question_id) {
      
       $("#verify_location_error").slideUp();
       $("input.error").removeClass("error");
       $('#verify_location_error').html("");
       
       
       
       var empty = 0;
    
    $("#vote_form input").each(function() {
    	
    	if( $(this).val() === "" ) {
        	$(this).addClass("error");
			empty++;
		}
		
    });
    
    //handle all possible errors
    
    if( empty > 0 || !validators.email($("#vote_email").val()) || !validators.zip($("#vote_zip").val())) {
    
      if( empty > 0 ){	
    		$("#add_question_error .empty_input").fadeIn();
      }
      
      if(!validators.email($("#vote_email").val())){
      	   $("#vote_email").addClass("error");
		   $("#verify_location_error .invalid_email").fadeIn();
	  }
	   
	  if(!validators.zip($("#vote_zip").val())){
	  	   $("#vote_zip").addClass("error");
		   $("#verify_location_error .invalid_zip").fadeIn();
	  }

      
            $("#verify_location_error").slideDown();

			return false;
	  }
       
       
       
      var data = {
          "action_vote": question_id,
          "status": "incomplete",
      };

      ga("send", "event", "vote", "initial", question_id, 
         (od.votes[parseInt(question_id)] || []).length);

      if( od.akid ) {
        data.akid = od.akid;
      } else {
        if( od.recognized_user
            && od.recognized_user.email && od.recognized_user.zip ) {
            data.email = od.recognized_user.email;
            data.zip = od.recognized_user.zip;
        } else {
            var user_data = od.vote_user_data_fetcher(question_id);
            if( user_data === false ) {
                return false;
            }
            $.each(user_data, function(i, n) {
                data[i] = n;
            });
        }
      }
      
      
      
      submitActionkitForm(od.pages.votecheck, data, 
        function(result, data) {
          if( result == "success" ) {
            var akid = data.match(/akid=(\.\d+\.[\d\w\-_]+)&/);
            if( akid && akid.length ) {
              akid = akid[1];
              var user_id = parseInt(akid.split(".")[1]);
              od.setAkid(akid);

              ga("send", "event", "vote", "attempt", question_id, 
                 (od.votes[parseInt(question_id)] || []).length);

              od.submitVote(question_id, akid, user_id);
            }
          } else {
            od.vote_submitted_callback(result, data);
          }
        });
  };

  obviel.view({
    iface: "recognized_user",
    obvtUrl: "templates/recognized_user.html"
  });
  obviel.view({
    iface: "question",
    obvtUrl: "templates/question.html"
  });

  var map_popup_template = null;
  $.ajax("templates/question_in_map.html", {
      success: function(data) {
          map_popup_template = Handlebars.compile(data);
      } 
  });
  obviel.view({
    iface: "question",
    name: "question_detail",
    obvtUrl: "templates/question_detail.html"
  });
  obviel.view({
    iface: "question_votes",
    render: function() {
      if( !od.votes ) return;
      var vote_tally = od.votes[parseInt(this.obj.question_id)] || [];
      this.el.text(vote_tally.length);
    }
  });
  obviel.view({
    iface: "empty",
    "html": ""
  });
  obviel.view({
    iface: "list",
    obvtUrl: "templates/list.html"
  });

  od.render = function() {

    if( !od.data || !od.data.entries ) {
      throw "No questions have been loaded yet.";
    }

    var hash = window.location.hash;
    if( hash[0] !== "#" || hash[1] !== "/" ) {
        hash = "#/" + hash;
        window.location.hash = hash;
        return;
    }
    if( hash[hash.length-1] !== "/" ) {
        window.location.hash = hash + "/";
        return;
    }

    var map_view = hash.match(/^\#\/location\//);
    if( map_view ) {
        var y, x;
        var coords = hash.substr(11).replace("/", "");
        if( coords ) {
          coords = coords.split(",");
          if( coords.length == 2 ) {
            y = parseFloat(coords[0]);
            x = parseFloat(coords[1]);
          }
        }
        $("#map").show(); $("#container").hide();
        od.map_layer.clearLayers();

        var markers_layer = [];
        $.each(od.data.entries, function(i, obj) {
            if( obj.iface !== "question" ) return;
            var marker = L.marker([obj.y, obj.x]).bindPopup(
                map_popup_template(obj));
            markers_layer.push(marker);
        });
            
        od.map_layer.addLayers(markers_layer);
        od.map.invalidateSize();
        if( !x || !y ) {
            od.map.fitBounds(od.map_layer.getBounds());
        } else {
            od.map.setView([y, x], 10);
        }

    } else {
      $("#map").hide(); $("#container").show();
      od.map_layer.clearLayers();
    }
    var active_question = hash.match(/^\#\/question\/(\d+)\/$/);

    if( active_question ) { active_question = parseInt(active_question[1]); }
    if( active_question ) {
      for( var i=0; i<od.data.entries.length; ++i ) {
        if( od.data.entries[i].id == active_question ) {
          active_question = od.data.entries[i];
          break;
        }
      }
      if( active_question.iface !== "question" ) {
        active_question = null;
      } 
    }
    if( active_question ) {
      $("#container").render(active_question, "question_detail").done(od.refresh);
    } else {
      var active_sort = hash.match(/^\#\/sort\/(\w+)\//);
      var page = hash.match(/^\#\/sort\/\w+\/p(\d+)\/$/);
      if( active_sort ) { active_sort = active_sort[1]; }
      if( page ) { page = parseInt(page[1]); }
      if( active_sort === "date" && od.dataSort !== "date" ) {
        od.sortByDate();
      } else if( active_sort === "votes" && od.dataSort !== "votes" ) {
        od.sortByVotes(); 
      }
      if( !page && !map_view ) {
        window.location.hash = "#/sort/" + (active_sort || "votes") + "/p1/";
        return;
      }

      od.data.pages = {};
      od.data.pages.current = page;
      recalcPage();

      $("#container").render(od.data).done(od.refresh);
    }
  };

  od.processOneFetchedVoter = function(json) {
      for( var i=0; i<json.length-1; ++i ) { // json will have an empty object at the end of its array
          var vote = json[i];
          var tally = od.votes[parseInt(vote.question_id)] || [];
          var found = false;
          for( var j=0; j<tally.length; ++j ) {
              if( tally[j].id === vote.id ) {
                  found = true;
              }
          }
          if( !found ) {
              tally.push(vote);
          }
          od.votes[parseInt(vote.question_id)] = tally;
      }
      var questions = od.data.entries;
      for( var i=0; i<questions.length; ++i ) {
          var question = questions[i];
          question.votes = (od.votes[question.id] || []).length;
      }
      od.render();
  };
    
  od.processFetchedQuestions = function(json) {
    od.data = json;
    od.render();
  };

  od.processOneFetchedQuestion = function(question) {
      question = question[0]; // this will be an array of two elements, whose second element is an empty object

      od.data.entries.push(question);
      od.dataSort = null; // force a re-sort
      window.location.hash = "#/sort/date/";
      od.render();
  };

  od.fetchQuestions = function() {

    $.ajax({
          type: 'GET',
          url: od.data_proxies.question,
          async: false,
          jsonp: "jsonp",
          contentType: "application/json",
          dataType: 'jsonp',
          success: od.processFetchedQuestions
    });
  };

  od.addVote = function(question_id) {
    if( !od.votes ) { throw "Vote data has not yet been loaded." };
    var tally = od.votes[question_id] || [];
    tally.push({"iface": "vote", "placeholder": true, "question_id": question_id});
    od.votes[question_id] = tally;
  };

  od.getVotesForUser = function(user_id) {
    if( !od.votes ) {
      throw "Vote data has not yet been loaded.";
    }
    var votes = [];
    $.each(od.votes, function(question_id, votes_for_question) {
      $.each(votes_for_question, function(i, vote) {
        if( vote.user_id == user_id ) {
          votes.push(parseInt(vote.question_id));
        }
      });
    });
    return votes;
  };

  od.mergeVotes = function(votes) {
    od.votes = {};
    $.each(votes.entries, function(i, vote) { 
      if( vote.iface != "vote" ) return;
      var tally = od.votes[parseInt(vote.question_id)] || [];
      tally.push(vote);
      od.votes[parseInt(vote.question_id)] = tally;
    });
  };

  od.processFetchedVotes = function(json) {
      od.mergeVotes(json);
      od.render();
  };

  od.fetchVotes = function() {

    $.ajax({
          type: 'GET',
          url: od.data_proxies.vote,
          async: false,
          jsonp: "jsonp",
          contentType: "application/json",
          dataType: 'jsonp',
          success: od.processFetchedVotes
    });
  };

  od.sortByDate = function() {
    if( !od.data ) {
      throw "No data has been loaded yet."
    }
    od.data.entries.sort(function(a, b) { 
        var aDate = new Date(a.created), bDate = new Date(b.created);
        if( aDate < bDate ) {
            return 1;
        } else if( aDate > bDate ) {
            return -1;
        } else {
            return 0;
        }
    });
    od.dataSort = "date";

    od.data.pages = {};
    od.data.pages.current = 1;

    recalcPage();

  };
  od.sortByVotes = function() {
    if( !od.data || !od.votes ) {
      throw "No data has been loaded yet."
    }
    od.data.entries.sort(function(a, b) { 
      
      if( a.votes < b.votes ) {
          return 1;
      } else if( a.votes > b.votes ) {
          return -1;
      } else {
          return 0;
      }
    });
    od.dataSort = "votes";

    od.data.pages = {};
    od.data.pages.current = 1;

    recalcPage();

  };

  var recalcPage = function() {

    od.data.pages.previous = null;
    od.data.pages.next = null;

    var total = od.data.pages.total = Math.ceil(od.data.entries.length / 20);

    var current = od.data.pages.current;

    var next = current + 1;
    if( next <= total ) {
      od.data.pages.next = "/sort/" + od.dataSort + "/p" + next + "/";
    }
    var prev = current - 1;
    if( prev > total ) {
      prev = total;
    }
    if( prev > 0 ) {
      od.data.pages.previous = "/sort/" + od.dataSort + "/p" + prev + "/";
    }
    var this_page = od.data.pages.entries = [];
    for( var i=((current-1) * 20); i < (current*20) && (i < od.data.entries.length); ++i ) {
        this_page.push(od.data.entries[i]);
    }
  };

  od.pageNext = function() {
    od.data.pages.current += 1;
    recalcPage();
  };
  od.pagePrev = function() {
    od.data.pages.current -= 1;
    recalcPage();
  };

})(jQuery, obviel);
