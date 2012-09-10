Backbone.Mobile = (function(Backbone, _, $){
  var Mobile = {};

  // BindTo: Event Binding
  // ---------------------

  // BindTo facilitates the binding and unbinding of events
  // from objects that extend `Backbone.Events`. It makes
  // unbinding events, even with anonymous callback functions,
  // easy. 
  //
  // Thanks to Johnny Oshika for this code.
  // http://stackoverflow.com/questions/7567404/backbone-js-repopulate-or-recreate-the-view/7607853#7607853

  Mobile.BindTo = {

    // Store the event binding in array so it can be unbound
    // easily, at a later point in time.
    bindTo: function (obj, eventName, callback, context) {
      context = context || this;
      obj.on(eventName, callback, context);

      if (!this.bindings) { this.bindings = []; }

      var binding = { 
        obj: obj, 
        eventName: eventName, 
        callback: callback, 
        context: context 
      }

      this.bindings.push(binding);

      return binding;
    },

    // Unbind from a single binding object. Binding objects are
    // returned from the `bindTo` method call. 
    unbindFrom: function(binding){
      binding.obj.off(binding.eventName, binding.callback, binding.context);
      this.bindings = _.reject(this.bindings, function(bind){return bind === binding});
    },

    // Unbind all of the events that we have stored.
    unbindAll: function () {
      var that = this;

      // The `unbindFrom` call removes elements from the array
      // while it is being iterated, so clone it first.
      var bindings = _.map(this.bindings, _.identity);
      _.each(bindings, function (binding, index) {
        that.unbindFrom(binding);
      });
    }
  };

  // Marionette.View
  // ---------------

  // The core view type that other Marionette views extend from.
  Mobile.View = Backbone.View.extend({
    constructor: function(){
      Backbone.View.prototype.constructor.apply(this, arguments);
      this.bindTo(this, "show", this.onShowCalled, this);
    },

    // Get the template for this view
    // instance. You can set a `template` attribute in the view
    // definition or pass a `template: "whatever"` parameter in
    // to the constructor options. 
    getTemplate: function(){
      var template;

      // Get the template from `this.options.template` or
      // `this.template`. The `options` takes precedence.
      if (this.options && this.options.template){
        template = this.options.template;
      } else {
        template = this.template;
      }

      return template;
    },

    // Serialize the model or collection for the view. If a model is
    // found, `.toJSON()` is called. If a collection is found, `.toJSON()`
    // is also called, but is used to populate an `items` array in the
    // resulting data. If both are found, defaults to the model. 
    // You can override the `serializeData` method in your own view 
    // definition, to provide custom serialization for your view's data.
    serializeData: function(){
      var data;

      if (this.model) { 
        data = this.model.toJSON(); 
      }
      else if (this.collection) {
        data = { items: this.collection.toJSON() };
      }

      data = this.mixinTemplateHelpers(data);

      return data;
    },

    // Mix in template helper methods. Looks for a
    // `templateHelpers` attribute, which can either be an
    // object literal, or a function that returns an object
    // literal. All methods and attributes from this object
    // are copies to the object passed in.
    mixinTemplateHelpers: function(target){
      target = target || {};
      var templateHelpers = this.templateHelpers;
      if (_.isFunction(templateHelpers)){
        templateHelpers = templateHelpers.call(this);
      }
      return _.extend(target, templateHelpers);
    },

    // Configure `triggers` to forward DOM events to view
    // events. `triggers: {"click .foo": "do:foo"}`
    configureTriggers: function(){
      if (!this.triggers) { return; }

      var triggers = this.triggers;
      var that = this;
      var triggerEvents = {};

      // Allow `triggers` to be configured as a function
      if (_.isFunction(triggers)){ triggers = triggers.call(this); }

      // Configure the triggers, prevent default
      // action and stop propagation of DOM events
      _.each(triggers, function(value, key){

        triggerEvents[key] = function(e){
          if (e && e.preventDefault){ e.preventDefault(); }
          if (e && e.stopPropagation){ e.stopPropagation(); }
          that.trigger(value);
        }

      });

      return triggerEvents;
    },

    // Overriding Backbone.View's delegateEvents specifically
    // to handle the `triggers` configuration
    delegateEvents: function(events){
      events = events || this.events;
      if (_.isFunction(events)){ events = events.call(this)}

      var combinedEvents = {};
      var triggers = this.configureTriggers();
      _.extend(combinedEvents, events, triggers);

      Backbone.View.prototype.delegateEvents.call(this, combinedEvents);
    },

    // Internal method, handles the `show` event.
    onShowCalled: function(){},

    // Default `close` implementation, for removing a view from the
    // DOM and unbinding it. Regions will call this method
    // for you. You can specify an `onClose` method in your view to
    // add custom code that is called after the view is closed.
    close: function(){
      if (this.beforeClose) { this.beforeClose(); }

      this.remove();

      if (this.onClose) { this.onClose(); }
      this.trigger('close');
      this.unbindAll();
      this.unbind();
    }
  });

  // Copy the features of `BindTo`
  _.extend(Mobile.View.prototype, Mobile.BindTo);

  // AppRouter
  // ---------

  // Reduce the boilerplate code of handling route events
  // and then calling a single method on another object.
  // Have your routers configured to call the method on
  // your object, directly.
  //
  // Configure an AppRouter with `appRoutes`.
  //
  // App routers can only take one `controller` object. 
  // It is recommended that you divide your controller
  // objects in to smaller peices of related functionality
  // and have multiple routers / controllers, instead of
  // just one giant router and controller.
  //
  // You can also add standard routes to an AppRouter.

  Mobile.AppRouter = Backbone.Router.extend({

    constructor: function(options){
      Backbone.Router.prototype.constructor.call(this, options);

      if (this.appRoutes){
        var controller = this.controller;
        if (options && options.controller) {
          controller = options.controller;
        }
        this.processAppRoutes(controller, this.appRoutes);
      }
    },

    // Internal method to process the `appRoutes` for the
    // router, and turn them in to routes that trigger the
    // specified method on the specified `controller`.
    processAppRoutes: function(controller, appRoutes){
      var method, methodName;
      var route, routesLength, i;
      var routes = [];
      var router = this;

      for(route in appRoutes){
        if (appRoutes.hasOwnProperty(route)){
          routes.unshift([route, appRoutes[route]]);
        }
      }

      routesLength = routes.length;
      for (i = 0; i < routesLength; i++){
        route = routes[i][0];
        methodName = routes[i][1];
        method = controller[methodName];

        if (!method){
          var msg = "Method '" + methodName + "' was not found on the controller";
          var err = new Error(msg);
          err.name = "NoMethodError";
          throw err;
        }

        method = _.bind(method, controller);
        router.route(route, methodName, method);
      }
    }
  });

  return Mobile;
  
})(Backbone, _, window.jQuery || window.Zepto || window.ender);
