
      function processActionkitFormResponse(data, callback) {
        $("iframe#crossdomain").remove();
        if( data.result == "error" ) {
          callback && callback("error", data.errors);
        } else if( data.result == "success" ) {
           callback && callback("success", data.redirect);
        } else {
          console && console.log && console.log(data);
        }
      } 

      if( window.PCCCAKASYNCeventListenerAdded !== true ) {
        window.addEventListener("message", function(response) { 
          var data = response.data;
          if( !data.match(/^processActionkitFormResponse/) ) {
            return true;
          }
          // The data is a jsonp style string so let's just extract out
          // the json data from within it. But first we need to extract 
          // our callback function.
          data = data.substr(28).match(/^([\w\d]+)\((.*)\)$/);
          if( !data ) return true;
          var callback_name = data[1];
          data = JSON.parse(data[2]);
          var callback = window[callback_name];
          processActionkitFormResponse(data, callback);
          delete window[callback_name];
        });
        window.PCCCAKASYNCeventListenerAdded = true;
      }

      function submitActionkitForm(pageName, data, callback) {
        $("<iframe />").attr("id", "crossdomain").hide().appendTo("body");
        var form = $("<form />").attr("method", "POST")
                                .attr("target", "crossdomain")
                                .hide().appendTo("body");
        $.each(data, function(i, n) { 
          if( typeof(n) == "object" ) {
            $.each(n, function(j, m) {
              $("<input>").attr("name", i).attr("value", m).appendTo(form);
            });
          } else {
            $("<input>").attr("name", i).attr("value", n).appendTo(form);
          }
        });
        $("<input>").attr("name", "js").attr("value", "1").appendTo(form);

        var callback_name = "PCCCAKASYNC" + Math.floor(Math.random() * 10000000000);
        window[callback_name] = callback;
        $("<input>").attr("name", "callback")
                    .attr("value", 
                          window.location.href.replace(
                            window.location.hash, "").replace(/\#$/, "") + 
                          "#processActionkitFormResponse" + callback_name)
                    .appendTo(form);
        $("<input>").attr("name", "page").attr("value", pageName).appendTo(form);
        form.attr("action", "https://act.boldprogressives.org/act/");
        form.submit();
        form.remove();
      };
