
var KEYS = ["shift","ctrl","alt","meta"]

var port = chrome.extension.connect()
port.onMessage.addListener(function(msg) {
  if (msg.saveOptions) {
    options = msg.saveOptions
  }
})

WetBanana = (function() {

  function mpcall(f) {
    return function() {
      try {
        f.apply(this,arguments)
      } catch(ex) {
        alert(""+ex)
      }
    }
  }

  function vadd(a,b)   { return [a[0]+b[0], a[1]+b[1]] }
  function vsub(a,b)   { return [a[0]-b[0], a[1]-b[1]] }
  function vmul(s,v)   { return [s*v[0], s*v[1]] }
  function vdiv(s,v)   { return [v[0]/s, v[1]/s] }
  function vmag2(v)    { return v[0]*v[0] + v[1]*v[1] }
  function vmag(v)     { return Math.sqrt(v[0]*v[0] + v[1]*v[1]) }
  function vunit(v)    { return vdiv(vmag(v),v) }
  
  const TIME_STEP = 0
  const MIN_SPEED_SQUARED =   1
  const FILTER_INTERVAL = 200
  
  var dragging = false
  var dragged = false
  var mouseOrigin = null
  var windowOrigin = null
  var timeoutId = null

  var position = null
  var date = null

  // var mousePos = [[0,0],[0,0],[0,0],[0,0]]
  var events = [];
  var velocity = [0,0]

  var scrolling = false

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
    windowOrigin = [window.pageXOffset, window.pageYOffset]
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

  function updateScrollPosition() {
    scrolling = true
    window.scrollTo(windowOrigin[0] - (position[0] - mouseOrigin[0])*options.scaling,
                    windowOrigin[1] - (position[1] - mouseOrigin[1])*options.scaling)
    scrolling = false
  }
  
  function onTimer() {
    if (updateFreeMotion()) {
      updateScrollPosition()
      timeoutId = window.setTimeout(onTimer,TIME_STEP)
    }
  }

  function stopMotion() {
    velocity = [0,0]
    date = null
    if (timeoutId != null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
  }
  
  function startDrag(ev) {
    dragging = true
    dragged = false
    resetMotion(ev)
    updateEventFilter(ev)

    document.body.style.cursor = "move"
    document.addEventListener("mousemove", onMouseMove, true)
  }

  function stopDrag(ev) {
    document.removeEventListener("mousemove", onMouseMove, true)
    document.body.style.cursor = "default"

    updateEventFilter(ev)
    dragging = false

    if (sampleMotion(ev)) {
      timeoutId = window.setTimeout(onTimer,TIME_STEP)
    }
  }

  function onMouseDown(ev) {
    stopMotion()
    if (ev.button == options.button) {
      for (var i = 0; i < KEYS.length; i++) {
        if (options['key_'+KEYS[i]]+'' == 'true' && !ev[KEYS[i]+"Key"]) return;
      }
      startDrag(ev)
      ev.preventDefault()
      ev.stopPropagation()
    }
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
      ev.stopPropagation()
    }
  }

  function onMouseOut(ev) {
    if (dragging && ev.toElement == null) stopDrag(ev)
  }

  function onMouseWheel(ev) {
    if (!scrolling) stopMotion()
  }
  
  return {
    init: function() {
      document.addEventListener("mousedown",     onMouseDown,  true)
      document.addEventListener("mouseup",       onMouseUp,    true)
      document.addEventListener("mouseout",      onMouseOut,   true)
      document.addEventListener("scroll",        onMouseWheel, true)
    }
  }
  
})()

WetBanana.init()

