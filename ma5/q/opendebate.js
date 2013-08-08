(function($, obviel) {

  var od = window.opendebate = {};

  od.init = function(question_page, vote_page, votecheck_page,
                     question_proxy, timeline_proxy, vote_proxy,
                     recognized_user_callback, 
                     submit_question_fetcher,
                     question_submitted_callback,
                     vote_user_data_fetcher,
                     vote_submitted_callback,
                     already_voted_callback) {

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

    od.votes_this_session = 0;

    od.pages = {};
    od.pages.question = question_page;
    od.pages.vote = vote_page;
    od.pages.votecheck = votecheck_page;
    od.data_proxies = {};
    od.data_proxies.question = question_proxy;
    od.data_proxies.timeline = timeline_proxy;
    od.data_proxies.vote = vote_proxy;

    od.recognized_user_callback = recognized_user_callback;
    od.submit_question_fetcher = submit_question_fetcher;
    od.question_submitted_callback = question_submitted_callback;
    od.vote_user_data_fetcher = vote_user_data_fetcher;
    od.vote_submitted_callback = vote_submitted_callback;
    od.already_voted_callback = already_voted_callback;

    od.setAkid();

    var map = od.map = L.map('map', {"maxZoom": 12}).setView([42.447222, -71.225], 10);
    L.tileLayer('http://{s}.tile.cloudmade.com/08b509de1e88474f986310c40caf2dc2/997/256/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
      maxZoom: 18
    }).addTo(map);
    od.map_layer = L.markerClusterGroup({ maxClusterRadius: 30 }).addTo(map);
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
    od.fetchTimeline();

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
                   url: "//act.boldprogressives.org/cms/thanks/" + od.pages.votecheck + "?checkAkid=yes&akid=" + akid,
                   async: false,
                   jsonp: "jsonp",
                   contentType: "application/json",
                   dataType: 'jsonp',
                   success: od.processUserRecognition
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
      var votes = null;
      if( od.recognized_user && od.recognized_user.id && (user.id == od.recognized_user.id) ) {
          votes = od.recognized_user.votes;
      }
      od.recognized_user = {
          iface: "recognized_user",
          akid: user.akid,
          email: user.email,
          zip: user.zip,
          first_name: user.first_name,
          last_name: user.last_name,
          id: user.id,
          votes: votes
      };
      od.recognized_user.best_name = (user.first_name && user.last_name) ? (user.first_name + " " + user.last_name) : user.email;
      $("#recognized_user").render(od.recognized_user);
      od.getVotesForUser(user.id);
      od.recognized_user_callback && od.recognized_user_callback(true, od.recognized_user);
      od.refresh();
  };

  od.refresh = function(view) {
    od.map.invalidateSize();
    FB.XFBML.parse();
    
    if( od.recognized_user && od.recognized_user.id && od.recognized_user.votes ) {
      var votes = od.recognized_user.votes;
      $(".votes .vote-bottom").each(function() {
          var question = $(this)
              .closest(".votes").find("a.vote-button").data("question_id");
          if( !question ) {
              return;
          }
          if( votes.indexOf(question) != -1 ) {
              $(this).text("voted")
                  .css("font-size", "12px").css("color", "gray")
                  .css("background-color", "white");
          }
      });
    }
  };

  od.submitVote = function(question_id, akid, user_id) {
    var votes = (od.recognized_user && od.recognized_user.votes) || od.getVotesForUser(user_id);
    if( votes.indexOf(question_id) == -1 ) {
      votes.push(question_id);
    } else {
      od.already_voted_callback(question_id, votes);
      return false;
    }
  
    submitActionkitForm(od.pages.vote, {
        "akid": akid,
        "action_vote": votes,
        "source": $.cookie("pccc.source") || "",
        "status": "complete"
        }, function(result, data) {
             if( result == "success" ) {
               ga("send", "event", "vote", "complete", question_id, 
                  (od.votes[parseInt(question_id)] || []).length);

               var thanks_redirect = data;
               $.ajax({
                   type: 'GET',
                   url: "//act.boldprogressives.org" + thanks_redirect,
                   async: false,
                   jsonp: "jsonp",
                   contentType: "application/json",
                   dataType: 'jsonp',
                   success: od.processOneFetchedVoter
               });
               od.vote_submitted_callback("success", 
                                          {akid: akid, question_id: question_id});

             } else {
               ga("send", "event", "vote", "error", question_id, 
                  (od.votes[parseInt(question_id)] || []).length);
               console.log("Errors: " + JSON.stringify(data));
             }
        });
  };

Date.fromISO= (function(){
    var testIso = '2011-11-24T09:00:27+0200';
    // Chrome
    var diso= Date.parse(testIso);
    if(diso===1322118027000) return function(s){
        return new Date(Date.parse(s));
    }
    // JS 1.8 gecko
    var noOffset = function(s) {
      var day= s.slice(0,-5).split(/\D/).map(function(itm){
        return parseInt(itm, 10) || 0;
      });
      day[1]-= 1;
      day= new Date(Date.UTC.apply(Date, day));  
      var offsetString = s.slice(-5)
      var offset = parseInt(offsetString,10)/100; 
      if (offsetString.slice(0,1)=="+") offset*=-1;
      day.setHours(day.getHours()+offset);
      return day.getTime();
    }
    if (noOffset(testIso)===1322118027000) {
       return noOffset;
    }  
    return function(s){ // kennebec@SO + QTax@SO
        var day, tz, 
//        rx = /^(\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d{4}))?$/,
        rx = /^(\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))?$/,
            
        p= rx.exec(s) || [];
        if(p[1]){
            day= p[1].split(/\D/).map(function(itm){
                return parseInt(itm, 10) || 0;
            });
            day[1]-= 1;
            day= new Date(Date.UTC.apply(Date, day));
            if(!day.getDate()) return NaN;
            if(p[5]){
                tz= parseInt(p[5], 10)/100*60;
                if(p[6]) tz += parseInt(p[6], 10);
                if(p[4]== "+") tz*= -1;
                if(tz) day.setUTCMinutes(day.getUTCMinutes()+ tz);
            }
            return day;
        }
        return NaN;
    }
})();

  var datetime_formatter = function(gmt) {
      var zeroPadded = function(n) {
          return n < 10 ? "0" + n : "" + n;
      };
         
      var formatDate = function(datestring) {
          var last_updated = new Date(Date.fromISO(datestring)); // e.g. "Feb. 13, 2013, 03:39:14 AM", assumed to be UTC
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

  var excerpter = function(text) {
    if( text.length > 200 ) {
        var excerpt = text.substr(0, 200);
        for( var i=200; i<250 && i<text.length; ++i ) {
            if( text[i] === " " ) {
                break;
            }
            excerpt += text[i];
        }
        return excerpt + "...";
    }
    return text;
  };
  obviel.template.registerFormatter('excerpt', excerpter);
  Handlebars.registerHelper('excerpt', excerpter);

  od.submitQuestion = function() {
    ga("send", "event", "question", "submit");

    var data = od.submit_question_fetcher();
    if( data === false ) {
      return false;
    }

    data.source = $.cookie("pccc.source") || "";

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
          url: "//act.boldprogressives.org" + thanks_redirect,
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
        $("#verify_location_error").children().fadeOut();
       $("#verify_location_error input.error").removeClass("error");
 
      var q = $(".votes a.vote-button[data-question_id=" + question_id + "]");
      q.find(".vote_tally").css("color", "yellow");
      var t = q.find(".vote_tally span");
      if( t ) {
          var tI = parseInt(t.text());
          if( typeof(tI) === "number" ) {
              t.text(tI + 1);
          }
      }

          q.closest(".votes").find(".vote-bottom")
            .text("voted")
            .css("font-size", "12px").css("color", "gray")
            .css("background-color", "white");      
       
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
      
      data.source = $.cookie("pccc.source") || "";      
      
      submitActionkitForm(od.pages.votecheck, data, 
        function(result, data) {
          if( result == "success" ) {

              od.votes_this_session += 1;

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
    iface: "empty",
    "html": ""
  });
  obviel.view({
    iface: "list",
    obvtUrl: "templates/list.html"
  });
  obviel.view({
    iface: "searchList",
    obvtUrl: "templates/search.html"
  });
  obviel.view({
    iface: "timeline",
    obvtUrl: "templates/activity.html"
  });
  obviel.view({
    iface: "timeline_question",
    obvtUrl: "templates/activity_question.html"
  });
  obviel.view({
    iface: "timeline_vote",
    obvtUrl: "templates/activity_vote.html"
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
        $("a[data-sort]").css("font-weight", "normal");
        $("a[data-sort=map]").css("font-weight", "bold");

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
      } else if( active_sort === "state_votes" && od.dataSort !== "state_votes" ) {
        od.sortByStateVotes(); 
      } else if( active_sort === "recent_votes" && od.dataSort !== "recent_votes" ) {
        od.sortByRecentVotes(); 
      } else if( active_sort === "random" && od.dataSort !== "random" ) {
        od.sortByRandom(); 
      }
      if( !page && !map_view ) {
        window.location.hash = "#/sort/" + (active_sort || "votes") + "/p1/";
        return;
      }
      if( !map_view ) {
          $("a[data-sort]").css("font-weight", "normal");
          $("a[data-sort=" + od.dataSort + "]").css("font-weight", "bold");
      }
      od.data.pages = {};
      od.data.pages.current = page;
      recalcPage();

      $("#container").render(od.data).done(od.refresh);
    }
  };

  od.search = function(text) { 
    od.searchResults = {"iface": "searchList", "total": od.data.entries.length,
                        "search": text, "entries": []};
    var re = new RegExp(text, "i");
    od.searchResults.entries = $.grep(od.data.entries, function(e) {
        return (e.submission && 
                  e.submission.match(re));
            ;
    });
    $("#container").render(od.searchResults).done(od.refresh);
  };
  od.clearSearch = function() {
    od.searchResults = null;
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

  od.fetchTimeline = function() {
    $.ajax({
          type: 'GET',
          url: od.data_proxies.timeline,
          async: false,
          jsonp: "jsonp",
          contentType: "application/json",
          dataType: 'jsonp',
          success: od.processTimeline
    });
  };
  od.processTimeline = function(data) {
      $("#activity_entries").render(data).done(function() {
          window.setTimeout(od.fetchTimeline, 1000);
      });
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
    if( od.recognized_user && od.recognized_user.id == user_id && !(od.recognized_user.votes) ) {
        od.recognized_user.votes = votes
    };
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
        var aDate = new Date(Date.fromISO(a.created)), bDate = new Date(Date.fromISO(b.created));
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
    if( !od.data ) {
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
  od.sortByRandom = function() { 
    if( !od.data ) {
      throw "No data has been loaded yet."
    }
    od.data.entries.sort(function(a, b) { 
        return Math.floor(Math.random() * 3) - 1;
    });
    od.dataSort = "random";

    od.data.pages = {};
    od.data.pages.current = 1;

    recalcPage();
    
  };
  od.sortByRecentVotes = function() {
    if( !od.data ) {
      throw "No data has been loaded yet."
    }
    od.data.entries.sort(function(a, b) { 
        var a = a.trending_score || 0,
            b = b.trending_score || 0;
        if( a < b ) {
            return 1;
        } else if( a > b ) {
            return -1;
        } else {
            return 0;
        }
    });
    od.dataSort = "recent_votes";

    od.data.pages = {};
    od.data.pages.current = 1;

    recalcPage();

  };

  od.sortByStateVotes = function() {
    if( !od.data ) {
      throw "No data has been loaded yet."
    }
    od.data.entries.sort(function(a, b) { 
      
      if( a.state_votes < b.state_votes ) {
          return 1;
      } else if( a.state_votes > b.state_votes ) {
          return -1;
      } else {
          return 0;
      }
    });
    od.dataSort = "state_votes";

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
