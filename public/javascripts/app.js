var App = {
  Models: {},
  Views: {},
  Collections: {}
};

App.Router = Backbone.Router.extend({
  routes: {
    "": "list"
  },
  
  list: function() {
  }
     
})

new App.Router();
Backbone.history.start();

// if (Modernizr.overflowscrolling) {
//   alert('here....');
// }

document.addEventListener("touchmove", function(evt){
	evt.preventDefault();
}, false);

var container = document.getElementById("container");
container.addEventListener("touchmove", function(evt){
	evt.stopPropagation();
}, false);