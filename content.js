

WetBanana = (function() {

  // === Debuggering ===

  function debug() {
    if (options.debug) {
      console.debug.apply(console,["WB:"].concat(Array.prototype.slice.call(arguments)))
    }
  }

  const DEBUG_INTERVAL = 200
  var lastDebug = 0
  
  function debugCont() {
    if (options.debug) {
      var now = Date.now()
      if (lastDebug+DEBUG_INTERVAL <= now) {
        lastDebug = now
        debug.apply(this,arguments)
      }
    }
  }


  // === Util ===

  String.prototype.padLeft = function(n,c) {
    if (!c) c = ' '
    var a = []
    for (var i = this.length; i < n; i++) a.push(c)
    a.push(this)
    return a.join('')
  }
  
  function formatCoord(n) {
    return new Number(n).toFixed(3).padLeft(8)
  }
  
  function formatVector(v) {
    return "["+formatCoord(v[0])+","+formatCoord(v[1])+"]"
  }

  
  // === Vector math ===
  
  function vadd(a,b)   { return [a[0]+b[0], a[1]+b[1]] }
  function vsub(a,b)   { return [a[0]-b[0], a[1]-b[1]] }
  function vmul(s,v)   { return [s*v[0], s*v[1]] }
  function vdiv(s,v)   { return [v[0]/s, v[1]/s] }
  function vmag2(v)    { return v[0]*v[0] + v[1]*v[1] }
  function vmag(v)     { return Math.sqrt(v[0]*v[0] + v[1]*v[1]) }
  function vunit(v)    { return vdiv(vmag(v),v) }

  
  // === DOM fun ===

  // Can the given element be scrolled on either axis?
  // That is, is the scroll size greater than the client size
  // and the CSS overflow set to scroll or auto?
  function isScrollable(e) {
    var o
    if (e.scrollWidth > e.clientWidth) {
      o = document.defaultView.getComputedStyle(e)["overflow-x"]
      if (o == "auto" || o == "scroll") return true
    }      
    if (e.scrollHeight > e.clientHeight) {
      o = document.defaultView.getComputedStyle(e)["overflow-y"]
      if (o == "auto" || o == "scroll") return true
    }
    return false
  }

  // Return the first ancestor (or the element itself) that is scrollable
  function findInnermostScrollable(e) {
    if (e == null || e == document.body || isScrollable(e)) {
      return e
    } else {
      return arguments.callee(e.parentNode)
    }
  }
  
  var KEYS = ["shift","ctrl","alt","meta"]
  const TIME_STEP = 0
  const MIN_SPEED_SQUARED =   1
  const FILTER_INTERVAL = 200

  // Don't drag when left-clicking on these elements
  const OVERRIDE_TAGS = ['A','INPUT','SELECT','TEXTAREA','BUTTON','LABEL']

  var options = null
  
  var dragging = false
  var dragged = false
  var dragElement = null
  var mouseOrigin = null
  var scrollOrigin = null
  var timeoutId = null

  var position = null
  var date = null

  // var mousePos = [[0,0],[0,0],[0,0],[0,0]]
  var events = [];
  var velocity = [0,0]

  var scrolling = false

  var port = chrome.extension.connect()
  port.onMessage.addListener(function(msg) {
    if (msg.saveOptions) {
      options = msg.saveOptions
      options.debug = (options.debug == "true")
      debug("saveOptions: ",options)
    }
  })

  function clampVelocity() {
    var speedSquared = vmag2(velocity)
    if (speedSquared <= MIN_SPEED_SQUARED) {
      velocity = [0,0]
      return false
    } else if (speedSquared > options.speed*options.speed) {
      velocity = vmul(options.speed,vunit(velocity))
    }
    return true
  }

  function resetMotion(ev) {
    mouseOrigin = [ev.clientX, ev.clientY]
    scrollOrigin = [dragElement.scrollLeft, dragElement.scrollTop]
    events = [ev]
  }

  function updateEventFilter(ev) {
    position = [ ev.clientX, ev.clientY ]
    while (events.length > 0 && (ev.timeStamp - events[0].timeStamp) > FILTER_INTERVAL) {
      events.shift()
    }
    events.push(ev)
    return events.length > 1
  }
  
  function sampleMotion(ev) {
    if (events.length < 2) {
      velocity = [0,0]
      return false
    } else {
      var oldest = events[0],
          newest = events[events.length-1]

      velocity = vdiv((newest.timeStamp - oldest.timeStamp)/1000,
                      vsub( [newest.clientX, newest.clientY],
                            [oldest.clientX, oldest.clientY] ))
      date = ev.timeStamp
      return clampVelocity()
    }
  }

  function updateFreeMotion() {
    var now = Date.now()
    if (date != null && now > date) {
      var deltaSeconds = (now-date)/1000

      velocity = vsub(velocity,vmul(options.friction*deltaSeconds,velocity))
      if (clampVelocity()) {
        position = vadd(position,vmul(deltaSeconds,velocity))
        date = now
        return true
      }
    }
    date = now
    return false
  }

  function setScroll(x,y) {
    dragElement.scrollLeft = x
    dragElement.scrollTop  = y
  }

  function getScroll() {
    var o = {};
    ['scrollWidth',
     'scrollHeight',
     'scrollTop',
     'scrollLeft',
     'clientWidth',
     'clientHeight'].forEach(function(k) {
      o[k] = dragElement[k]
     });

    if (dragElement == document.body) {
      o.clientHeight = window.innerHeight
      o.clientWidth  = window.innerWidth
    }

    return o
  }
  
  function updateScrollPosition() {
    var x =  Math.round(scrollOrigin[0] - (position[0] - mouseOrigin[0])*options.scaling)
    var y =  Math.round(scrollOrigin[1] - (position[1] - mouseOrigin[1])*options.scaling)
    var ax, ay

    scrolling = true
    setScroll(x,y)
    scrolling = false

    s = getScroll()
    debugCont("updateScrollPosition: try="+x+","+y+" actual="+s.scrollLeft+","+s.scrollTop)
    return (x >= 0 && x <= s.scrollWidth-s.clientWidth) ||
           (y >= 0 && y <= s.scrollHeight-s.clientHeight)
  }
  
  function onTimer() {
    if (updateFreeMotion() && updateScrollPosition()) {
      timeoutId = window.setTimeout(onTimer,TIME_STEP)
    } else {
      debug("motion stop")
      if (dragElement) {
        dragElement.removeEventListener("scroll", onScroll, true)
        dragElement = null
      }
    }
    // debugCont("onTimer velocity="+formatVector(velocity)+" position="+formatVector(position))
  }

  function stopMotion() {
    debug("stopMotion")
    velocity = [0,0]
    date = null
    if (timeoutId != null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
  }
  
  function startDrag(ev) {
    if (dragElement = findInnermostScrollable(ev.target)) {
      debug("startDrag dragElement="+dragElement.tagName)
      dragging = true
      dragged = false
      resetMotion(ev)
      updateEventFilter(ev)

      dragElement.addEventListener("scroll", onScroll, true)
      document.addEventListener("mousemove", onMouseMove, true)
      document.body.style.cursor = "move"
    } else {
      debug("no scrollable ancestor for element:",ev.target)
    }
  }

  function stopDrag(ev) {
    debug("stopDrag")
    document.body.style.cursor = "default"
    document.removeEventListener("mousemove", onMouseMove, true)

    updateEventFilter(ev)
    dragging = false

    if (sampleMotion(ev)) {
      timeoutId = window.setTimeout(onTimer,TIME_STEP)
    }
  }

  function onMouseDown(ev) {
    stopMotion()
    if (ev.button != options.button) {
      debug("wrong button, ignoring   ev.button="+ev.button+"   options.button="+options.button)
      return
    }
      
    if (!KEYS.every(function(key) { return (options['key_'+key]+'' == 'true') == ev[key+"Key"] })) {
      debug("wrong modkeys, ignoring")
      return
    }

    if (ev.target && OVERRIDE_TAGS.some(function(tag) { return tag == ev.target.tagName })) {
      debug("forbidden target element, ignoring   ev.target="+ev.target.tagName)
      return
    }

    startDrag(ev)
    ev.preventDefault()
  }

  function onMouseMove(ev) {
    if (dragging && (options.button == ev.button ||
                     options.button == 0)) {
      dragged = true
      updateEventFilter(ev)
      updateScrollPosition()
    } else {
      stopDrag(ev)
    }
  }

  function onMouseUp(ev) {
    if (dragging && ev.button == options.button) stopDrag(ev)
    if (dragged) {
      ev.preventDefault()
      // ev.stopPropagation()
    }
  }

  function onMouseOut(ev) {
    if (dragging && ev.toElement == null) stopDrag(ev)
  }

  function onScroll(ev) {
    if (!scrolling) {
      debug("onScroll: stopping motion")
      stopMotion()
    }
  }
  
  return {
    init: function() {
      document.addEventListener("mousedown",     onMouseDown,  true)
      document.addEventListener("mouseup",       onMouseUp,    true)
      document.addEventListener("mouseout",      onMouseOut,   true)
    }
  }
  
})()

WetBanana.init()

