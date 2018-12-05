import { schemePaired } from "d3-scale-chromatic";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceRadial
} from "d3-force";
import Bezier from "bezier-js";
import Kapsule from "kapsule";
import accessorFn from "accessor-fn";
import indexBy from "index-array-by";
import { select, event } from "d3-selection";
import { zoom, zoomTransform } from "d3-zoom";
import { drag } from "d3-drag";
import throttle from "lodash.throttle";
import TWEEN from "@tweenjs/tween.js";
import ColorTracker from "canvas-color-tracker";

function styleInject(css, ref) {
  if (ref === void 0) ref = {};
  var insertAt = ref.insertAt;

  if (!css || typeof document === "undefined") {
    return;
  }

  var head = document.head || document.getElementsByTagName("head")[0];
  var style = document.createElement("style");
  style.type = "text/css";

  if (insertAt === "top") {
    if (head.firstChild) {
      head.insertBefore(style, head.firstChild);
    } else {
      head.appendChild(style);
    }
  } else {
    head.appendChild(style);
  }

  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }
}

var css =
  ".graph-tooltip {\n  position: absolute;\n  transform: translate(-50%, 25px);\n  font-family: Sans-serif;\n  font-size: 16px;\n  padding: 4px;\n  border-radius: 3px;\n  color: #eee;\n  background: rgba(0,0,0,0.65);\n  visibility: hidden; /* by default */\n}\n\n.grabbable {\n  cursor: move;\n  cursor: grab;\n  cursor: -moz-grab;\n  cursor: -webkit-grab;\n}\n\n.grabbable:active {\n  cursor: grabbing;\n  cursor: -moz-grabbing;\n  cursor: -webkit-grabbing;\n}\n";
styleInject(css);

function _typeof(obj) {
  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function(obj) {
      return typeof obj;
    };
  } else {
    _typeof = function(obj) {
      return obj &&
        typeof Symbol === "function" &&
        obj.constructor === Symbol &&
        obj !== Symbol.prototype
        ? "symbol"
        : typeof obj;
    };
  }

  return _typeof(obj);
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    var ownKeys = Object.keys(source);

    if (typeof Object.getOwnPropertySymbols === "function") {
      ownKeys = ownKeys.concat(
        Object.getOwnPropertySymbols(source).filter(function(sym) {
          return Object.getOwnPropertyDescriptor(source, sym).enumerable;
        })
      );
    }

    ownKeys.forEach(function(key) {
      _defineProperty(target, key, source[key]);
    });
  }

  return target;
}

function _setPrototypeOf(o, p) {
  _setPrototypeOf =
    Object.setPrototypeOf ||
    function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };

  return _setPrototypeOf(o, p);
}

function isNativeReflectConstruct() {
  if (typeof Reflect === "undefined" || !Reflect.construct) return false;
  if (Reflect.construct.sham) return false;
  if (typeof Proxy === "function") return true;

  try {
    Date.prototype.toString.call(Reflect.construct(Date, [], function() {}));
    return true;
  } catch (e) {
    return false;
  }
}

function _construct(Parent, args, Class) {
  if (isNativeReflectConstruct()) {
    _construct = Reflect.construct;
  } else {
    _construct = function _construct(Parent, args, Class) {
      var a = [null];
      a.push.apply(a, args);
      var Constructor = Function.bind.apply(Parent, a);
      var instance = new Constructor();
      if (Class) _setPrototypeOf(instance, Class.prototype);
      return instance;
    };
  }

  return _construct.apply(null, arguments);
}

function _slicedToArray(arr, i) {
  return (
    _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest()
  );
}

function _toConsumableArray(arr) {
  return (
    _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread()
  );
}

function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++)
      arr2[i] = arr[i];

    return arr2;
  }
}

function _arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}

function _iterableToArray(iter) {
  if (
    Symbol.iterator in Object(iter) ||
    Object.prototype.toString.call(iter) === "[object Arguments]"
  )
    return Array.from(iter);
}

function _iterableToArrayLimit(arr, i) {
  var _arr = [];
  var _n = true;
  var _d = false;
  var _e = undefined;

  try {
    for (
      var _i = arr[Symbol.iterator](), _s;
      !(_n = (_s = _i.next()).done);
      _n = true
    ) {
      _arr.push(_s.value);

      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i["return"] != null) _i["return"]();
    } finally {
      if (_d) throw _e;
    }
  }

  return _arr;
}

function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance");
}

function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance");
}

// If an object has already a color, don't set it
// Objects can be nodes or links

function autoColorObjects(objects, colorByAccessor, colorField) {
  if (!colorByAccessor || typeof colorField !== "string") return;
  var colors = schemePaired; // Paired color set from color brewer

  var uncoloredObjects = objects.filter(function(obj) {
    return !obj[colorField];
  });
  var objGroups = {};
  uncoloredObjects.forEach(function(obj) {
    objGroups[colorByAccessor(obj)] = null;
  });
  Object.keys(objGroups).forEach(function(group, idx) {
    objGroups[group] = idx;
  });
  uncoloredObjects.forEach(function(obj) {
    obj[colorField] = colors[objGroups[colorByAccessor(obj)] % colors.length];
  });
}

function getDagDepths(_ref, idAccessor) {
  var nodes = _ref.nodes,
    links = _ref.links;
  // linked graph
  var graph = {};
  nodes.forEach(function(node) {
    return (graph[idAccessor(node)] = {
      data: node,
      out: [],
      depth: -1
    });
  });
  links.forEach(function(_ref2) {
    var source = _ref2.source,
      target = _ref2.target;
    var sourceId = getNodeId(source);
    var targetId = getNodeId(target);
    if (!graph.hasOwnProperty(sourceId))
      throw "Missing source node with id: ".concat(sourceId);
    if (!graph.hasOwnProperty(targetId))
      throw "Missing target node with id: ".concat(targetId);
    var sourceNode = graph[sourceId];
    var targetNode = graph[targetId];
    sourceNode.out.push(targetNode);

    function getNodeId(node) {
      return _typeof(node) === "object" ? idAccessor(node) : node;
    }
  });
  traverse(Object.values(graph)); // cleanup

  Object.keys(graph).forEach(function(id) {
    return (graph[id] = graph[id].depth);
  });
  return graph;

  function traverse(nodes) {
    var nodeStack =
      arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    var currentDepth = nodeStack.length;

    for (var i = 0, l = nodes.length; i < l; i++) {
      var node = nodes[i];

      if (nodeStack.indexOf(node) !== -1) {
        throw "Invalid DAG structure! Found cycle from node "
          .concat(idAccessor(nodeStack[nodeStack.length - 1].data), " to ")
          .concat(idAccessor(node.data));
      }

      if (currentDepth > node.depth) {
        // Don't unnecessarily revisit chunks of the graph
        node.depth = currentDepth;
        traverse(node.out, _toConsumableArray(nodeStack).concat([node]));
      }
    }
  }
}

var DAG_LEVEL_NODE_RATIO = 2;
var CanvasForceGraph = Kapsule({
  props: {
    graphData: {
      default: {
        nodes: [],
        links: []
      },
      onChange: function onChange(_, state) {
        state.engineRunning = false;
      } // Pause simulation
    },
    dagMode: {},
    // td, bu, lr, rl, radialin, radialout
    dagLevelDistance: {},
    nodeRelSize: {
      default: 4,
      triggerUpdate: false
    },
    // area per val unit
    nodeId: {
      default: "id"
    },
    nodeVal: {
      default: "val",
      triggerUpdate: false
    },
    nodeColor: {
      default: "color",
      triggerUpdate: false
    },
    nodeAutoColorBy: {},
    nodeCanvasObject: {
      triggerUpdate: false
    },
    linkSource: {
      default: "source"
    },
    linkTarget: {
      default: "target"
    },
    linkColor: {
      default: "color",
      triggerUpdate: false
    },
    linkAutoColorBy: {},
    linkWidth: {
      default: 1,
      triggerUpdate: false
    },
    linkCurvature: {
      default: 0,
      triggerUpdate: false
    },
    linkDirectionalArrowLength: {
      default: 0,
      triggerUpdate: false
    },
    linkDirectionalArrowColor: {
      triggerUpdate: false
    },
    linkDirectionalArrowRelPos: {
      default: 0.5,
      triggerUpdate: false
    },
    // value between 0<>1 indicating the relative pos along the (exposed) line
    linkDirectionalParticles: {
      default: 0
    },
    // animate photons travelling in the link direction
    linkDirectionalParticleSpeed: {
      default: 0.01,
      triggerUpdate: false
    },
    // in link length ratio per frame
    linkDirectionalParticleWidth: {
      default: 4,
      triggerUpdate: false
    },
    linkDirectionalParticleColor: {
      triggerUpdate: false
    },
    globalScale: {
      default: 1,
      triggerUpdate: false
    },
    d3AlphaDecay: {
      default: 0.0228,
      triggerUpdate: false,
      onChange: function onChange(alphaDecay, state) {
        state.forceLayout.alphaDecay(alphaDecay);
      }
    },
    d3AlphaTarget: {
      default: 0,
      triggerUpdate: false,
      onChange: function onChange(alphaTarget, state) {
        state.forceLayout.alphaTarget(alphaTarget);
      }
    },
    d3VelocityDecay: {
      default: 0.4,
      triggerUpdate: false,
      onChange: function onChange(velocityDecay, state) {
        state.forceLayout.velocityDecay(velocityDecay);
      }
    },
    warmupTicks: {
      default: 0,
      triggerUpdate: false
    },
    // how many times to tick the force engine at init before starting to render
    cooldownTicks: {
      default: Infinity,
      triggerUpdate: false
    },
    cooldownTime: {
      default: 15000,
      triggerUpdate: false
    },
    // ms
    onLoading: {
      default: function _default() {},
      triggerUpdate: false
    },
    onFinishLoading: {
      default: function _default() {},
      triggerUpdate: false
    },
    onEngineTick: {
      default: function _default() {},
      triggerUpdate: false
    },
    onEngineStop: {
      default: function _default() {},
      triggerUpdate: false
    },
    isShadow: {
      default: false,
      triggerUpdate: false
    }
  },
  methods: {
    // Expose d3 forces for external manipulation
    d3Force: function d3Force(state, forceName, forceFn) {
      if (forceFn === undefined) {
        return state.forceLayout.force(forceName); // Force getter
      }

      state.forceLayout.force(forceName, forceFn); // Force setter

      return this;
    },
    // reset cooldown state
    resetCountdown: function resetCountdown(state) {
      state.cntTicks = 0;
      state.startTickTime = new Date();
      state.engineRunning = true;
      return this;
    },
    tickFrame: function tickFrame(state) {
      layoutTick();
      paintLinks();
      paintArrows();
      paintPhotons();
      paintNodes();
      return this; //

      function layoutTick() {
        if (state.engineRunning) {
          if (
            ++state.cntTicks > state.cooldownTicks ||
            new Date() - state.startTickTime > state.cooldownTime
          ) {
            state.engineRunning = false; // Stop ticking graph

            state.onEngineStop();
          } else {
            state.forceLayout.tick(); // Tick it

            state.onEngineTick();
          }
        }
      }

      function paintNodes() {
        var getVal = accessorFn(state.nodeVal);
        var getColor = accessorFn(state.nodeColor);
        var ctx = state.ctx; // Draw wider nodes by 1px on shadow canvas for more precise hovering (due to boundary anti-aliasing)

        var padAmount = state.isShadow / state.globalScale;
        ctx.save();
        state.graphData.nodes.forEach(function(node) {
          if (state.nodeCanvasObject) {
            // Custom node paint
            state.nodeCanvasObject(node, state.ctx, state.globalScale);
            return;
          } // Draw wider nodes by 1px on shadow canvas for more precise hovering (due to boundary anti-aliasing)

          var r =
            Math.sqrt(Math.max(0, getVal(node) || 1)) * state.nodeRelSize +
            padAmount;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fillStyle = getColor(node) || "rgba(31, 120, 180, 0.92)";
          ctx.fill();
        });
        ctx.restore();
      }

      function paintLinks() {
        var getColor = accessorFn(state.linkColor);
        var getWidth = accessorFn(state.linkWidth);
        var getCurvature = accessorFn(state.linkCurvature);
        var ctx = state.ctx; // Draw wider lines by 2px on shadow canvas for more precise hovering (due to boundary anti-aliasing)

        var padAmount = state.isShadow * 2;
        ctx.save(); // Bundle strokes per unique color/width for performance optimization

        var linksPerColor = indexBy(state.graphData.links, [
          getColor,
          getWidth
        ]);

        Object.entries(linksPerColor).forEach(function(_ref) {
          var _ref2 = _slicedToArray(_ref, 2),
            color = _ref2[0],
            linksPerWidth = _ref2[1];

          var lineColor =
            !color || color === "undefined" ? "rgba(0,0,0,0.15)" : color;
          Object.entries(linksPerWidth).forEach(function(_ref3) {
            var _ref4 = _slicedToArray(_ref3, 2),
              width = _ref4[0],
              links = _ref4[1];

            var lineWidth = (width || 1) / 3 + padAmount;
            ctx.beginPath();
            links.forEach(function(link, idx) {
              var start = link.source;
              var end = link.target;
              if (
                isNaN(start.x) ||
                isNaN(start.y) ||
                isNaN(end.x) ||
                isNaN(end.y)
              )
                return;
              if (link.gradientCache.moved()) {
                //!link.gradient)
                var rgb = hex2rgb(lineColor);
                var gradient = ctx.createLinearGradient(
                  start.x,
                  start.y,
                  end.x,
                  end.y
                );
                // Add three color stops
                link.wut = [start.x, start.y, end.x, end.y];
                gradient.addColorStop(
                  0.1,
                  `rgba(${rgb.r},${rgb.g},${rgb.b},0.1)`
                );
                gradient.addColorStop(0.6, lineColor);
                gradient.addColorStop(0.81, lineColor);
                gradient.addColorStop(
                  0.91,
                  `rgba(${rgb.r},${rgb.g},${rgb.b},0.4)`
                );
                gradient.addColorStop(
                  0.95,
                  `rgba(${rgb.r},${rgb.g},${rgb.b},0.1)`
                );
                link.gradientCache.gradient = gradient;
                link.gradientCache.start = start;
                link.gradientCache.end = end;
              }

              if (!start.hasOwnProperty("x") || !end.hasOwnProperty("x"))
                return; // skip invalid link

              var curvature = getCurvature(link);
              ctx.moveTo(start.x, start.y);

              if (!curvature) {
                // Straight line
                ctx.lineTo(end.x, end.y);
                link.__controlPoints = null;
                return;
              }
              var l = Math.sqrt(
                Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
              ); // line length

              if (l > 0) {
                var a = Math.atan2(end.y - start.y, end.x - start.x); // line angle

                var d = l * curvature; // control point distance

                var cp = {
                  // control point
                  x: (start.x + end.x) / 2 + d * Math.cos(a - Math.PI / 2),
                  y: (start.y + end.y) / 2 + d * Math.sin(a - Math.PI / 2)
                };
                ctx.quadraticCurveTo(cp.x, cp.y, end.x, end.y);
                link.__controlPoints = [cp.x, cp.y];
              } else {
                // Same point, draw a loop
                var _d = curvature * 70;

                var cps = [end.x, end.y - _d, end.x + _d, end.y];
                ctx.bezierCurveTo.apply(ctx, cps.concat([end.x, end.y]));
                link.__controlPoints = cps;
              }
              // ctx.strokeStyle = gradient;
              ctx.strokeStyle =
                state.isShadow || (start.marked && end.marked)
                  ? lineColor
                  : link.gradientCache.gradient;
              ctx.lineWidth = lineWidth;
              ctx.stroke();
            });
          });
        });
        ctx.restore();
      }

      function paintArrows() {
        var ARROW_WH_RATIO = 1.6;
        var ARROW_VLEN_RATIO = 0.1;
        var getLength = accessorFn(state.linkDirectionalArrowLength);
        var getRelPos = accessorFn(state.linkDirectionalArrowRelPos);
        var getColor = accessorFn(
          state.linkDirectionalArrowColor || state.linkColor
        );
        var getNodeVal = accessorFn(state.nodeVal);
        var ctx = state.ctx;
        ctx.save();
        state.graphData.links.forEach(function(link) {
          ctx.beginPath();

          // just block it, fuck it
          if (!link.isSuccess()) return;
          var arrowLength = getLength(link);
          if (!arrowLength || arrowLength < 0) return;
          var start = link.source;
          var end = link.target;
          if (!start.hasOwnProperty("x") || !end.hasOwnProperty("x")) return; // skip invalid link

          var startR =
            Math.sqrt(Math.max(0, getNodeVal(start) || 1)) * state.nodeRelSize;
          var endR =
            Math.sqrt(Math.max(0, getNodeVal(end) || 1)) * state.nodeRelSize;
          var arrowRelPos = Math.min(1, Math.max(0, getRelPos(link)));
          var arrowColor = getColor(link) || "rgba(0,0,0,0.28)";
          var arrowHalfWidth = arrowLength / ARROW_WH_RATIO / 2; // Construct bezier for curved lines

          var bzLine =
            link.__controlPoints &&
            _construct(
              Bezier,
              [start.x, start.y].concat(
                _toConsumableArray(link.__controlPoints),
                [end.x, end.y]
              )
            );

          var getCoordsAlongLine = bzLine
            ? function(t) {
                return bzLine.get(t);
              } // get position along bezier line
            : function(t) {
                return {
                  // straight line: interpolate linearly
                  x: start.x + (end.x - start.x) * t || 0,
                  y: start.y + (end.y - start.y) * t || 0
                };
              };
          var lineLen = bzLine
            ? bzLine.length()
            : Math.sqrt(
                Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
              );
          var posAlongLine =
            startR +
            arrowLength +
            (lineLen - startR - endR - arrowLength) * arrowRelPos;
          var arrowHead = getCoordsAlongLine(posAlongLine / lineLen);
          var arrowTail = getCoordsAlongLine(
            (posAlongLine - arrowLength) / lineLen
          );
          var arrowTailVertex = getCoordsAlongLine(
            (posAlongLine - arrowLength * (1 - ARROW_VLEN_RATIO)) / lineLen
          );
          var arrowTailAngle =
            Math.atan2(arrowHead.y - arrowTail.y, arrowHead.x - arrowTail.x) -
            Math.PI / 2;
          ctx.lineDashOffset = 1;
          ctx.setLineDash([]);
          ctx.lineWidth = 0.6;
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(arrowHead.x, arrowHead.y);
          ctx.lineTo(
            arrowTail.x + arrowHalfWidth * Math.cos(arrowTailAngle),
            arrowTail.y + arrowHalfWidth * Math.sin(arrowTailAngle)
          );
          ctx.lineTo(arrowTailVertex.x, arrowTailVertex.y);
          ctx.lineTo(
            arrowTail.x - arrowHalfWidth * Math.cos(arrowTailAngle),
            arrowTail.y - arrowHalfWidth * Math.sin(arrowTailAngle)
          );
          ctx.lineTo(arrowHead.x, arrowHead.y);
          ctx.closePath();
          if (link.arrowPosition < 1) {
            ctx.shadowColor = "rgba(200,200,200,0.23)";
            ctx.shadowOffsetX = 4 * link.arrowPosition;
            ctx.shadowOffsetY = 4 * link.arrowPosition;
            ctx.shadowBlur = 12;
          }
          ctx.fillStyle = "#FEFEFE";
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.shadowColor = "rgba(0,0,0,0)";
          ctx.strokeStyle = "#FEFEFE";
          ctx.stroke();
          ctx.fillStyle = link.arrowBodyColor + link.opacity.toString(16);
          ctx.fill();
          ctx.lineWidth = 0.15;
          ctx.strokeStyle = arrowColor;
          ctx.stroke();

          ctx.beginPath();
          ctx.lineWidth = 0.12;
          ctx.setLineDash([0.2, 0.4]);
          ctx.lineDashOffset = 1;
          ctx.moveTo(arrowHead.x, arrowHead.y);
          ctx.lineTo(arrowTailVertex.x, arrowTailVertex.y);
          ctx.closePath();
          ctx.stroke();
        });
        ctx.restore();
      }

      function paintPhotons() {
        var getNumPhotons = accessorFn(state.linkDirectionalParticles);
        var getSpeed = accessorFn(state.linkDirectionalParticleSpeed);
        var getDiameter = accessorFn(state.linkDirectionalParticleWidth);
        var getColor = accessorFn(
          state.linkDirectionalParticleColor || state.linkColor
        );
        var ctx = state.ctx;
        ctx.save();
        state.graphData.links.forEach(function(link) {
          if (!getNumPhotons(link)) return;
          var start = link.source;
          var end = link.target;
          if (!start.hasOwnProperty("x") || !end.hasOwnProperty("x")) return; // skip invalid link

          var particleSpeed = getSpeed(link);
          var photons = link.__photons || [];
          var photonR =
            Math.max(0, getDiameter(link) / 2) / Math.sqrt(state.globalScale);
          var photonColor = getColor(link) || "rgba(0,0,0,0.28)";
          ctx.fillStyle = photonColor; // Construct bezier for curved lines

          var bzLine = link.__controlPoints
            ? _construct(
                Bezier,
                [start.x, start.y].concat(
                  _toConsumableArray(link.__controlPoints),
                  [end.x, end.y]
                )
              )
            : null;
          photons.forEach(function(photon, idx) {
            var photonPosRatio = (photon.__progressRatio =
              ((photon.__progressRatio || idx / photons.length) +
                particleSpeed) %
              1);
            var coords = bzLine
              ? bzLine.get(photonPosRatio) // get position along bezier line
              : {
                  // straight line: interpolate linearly
                  x: start.x + (end.x - start.x) * photonPosRatio || 0,
                  y: start.y + (end.y - start.y) * photonPosRatio || 0
                };
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, photonR, 0, 2 * Math.PI, false);
            ctx.fill();
          });
        });
        ctx.restore();
      }
    }
  },
  stateInit: function stateInit() {
    return {
      forceLayout: forceSimulation()
        .force("link", forceLink())
        .force("charge", forceManyBody())
        .force("center", forceCenter())
        .force("dagRadial", null)
        .stop(),
      engineRunning: false
    };
  },
  init: function init(canvasCtx, state) {
    // Main canvas object to manipulate
    state.ctx = canvasCtx;
  },
  update: function update(state) {
    state.engineRunning = false; // Pause simulation

    state.onLoading();

    if (state.nodeAutoColorBy !== null) {
      // Auto add color to uncolored nodes
      autoColorObjects(
        state.graphData.nodes,
        accessorFn(state.nodeAutoColorBy),
        state.nodeColor
      );
    }

    if (state.linkAutoColorBy !== null) {
      // Auto add color to uncolored links
      autoColorObjects(
        state.graphData.links,
        accessorFn(state.linkAutoColorBy),
        state.linkColor
      );
    } // parse links

    state.graphData.links.forEach(function(link) {
      link.source = link[state.linkSource];
      link.target = link[state.linkTarget];
    }); // Add photon particles

    var linkParticlesAccessor = accessorFn(state.linkDirectionalParticles);
    state.graphData.links.forEach(function(link) {
      var numPhotons = Math.round(Math.abs(linkParticlesAccessor(link)));

      if (numPhotons) {
        link.__photons = _toConsumableArray(Array(numPhotons)).map(function() {
          return {};
        });
      }
    }); // Feed data to force-directed layout

    state.forceLayout
      .stop()
      .alpha(1) // re-heat the simulation
      .nodes(state.graphData.nodes); // add links (if link force is still active)

    var linkForce = state.forceLayout.force("link");

    if (linkForce) {
      linkForce
        .id(function(d) {
          return d[state.nodeId];
        })
        .links(state.graphData.links);
    } // setup dag force constraints

    var nodeDepths =
      state.dagMode &&
      getDagDepths(state.graphData, function(node) {
        return node[state.nodeId];
      });
    var maxDepth = Math.max.apply(
      Math,
      _toConsumableArray(Object.values(nodeDepths || []))
    );
    var dagLevelDistance =
      state.dagLevelDistance ||
      (state.graphData.nodes.length / (maxDepth || 1)) *
        DAG_LEVEL_NODE_RATIO *
        (["radialin", "radialout"].indexOf(state.dagMode) !== -1 ? 0.7 : 1); // Fix nodes to x,y for dag mode

    if (state.dagMode) {
      var getFFn = function getFFn(fix, invert) {
        return function(node) {
          return !fix
            ? undefined
            : (nodeDepths[node[state.nodeId]] - maxDepth / 2) *
                dagLevelDistance *
                (invert ? -1 : 1);
        };
      };

      var fxFn = getFFn(
        ["lr", "rl"].indexOf(state.dagMode) !== -1,
        state.dagMode === "rl"
      );
      var fyFn = getFFn(
        ["td", "bu"].indexOf(state.dagMode) !== -1,
        state.dagMode === "bu"
      );
      state.graphData.nodes.forEach(function(node) {
        node.fx = fxFn(node);
        node.fy = fyFn(node);
      });
    }

    state.forceLayout.force(
      "dagRadial",
      ["radialin", "radialout"].indexOf(state.dagMode) !== -1
        ? forceRadial(function(node) {
            var nodeDepth = nodeDepths[node[state.nodeId]];
            return (
              (state.dagMode === "radialin"
                ? maxDepth - nodeDepth
                : nodeDepth) * dagLevelDistance
            );
          }).strength(1)
        : null
    );

    for (var i = 0; i < state.warmupTicks; i++) {
      state.forceLayout.tick();
    } // Initial ticks before starting to render

    this.resetCountdown();
    state.onFinishLoading();
  }
});

function linkKapsule(kapsulePropNames, kapsuleType) {
  var propNames =
    kapsulePropNames instanceof Array ? kapsulePropNames : [kapsulePropNames];
  var dummyK = new kapsuleType(); // To extract defaults

  return {
    linkProp: function linkProp(prop) {
      // link property config
      return {
        default: dummyK[prop](),
        onChange: function onChange(v, state) {
          propNames.forEach(function(propName) {
            return state[propName][prop](v);
          });
        },
        triggerUpdate: false
      };
    },
    linkMethod: function linkMethod(method) {
      // link method pass-through
      return function(state) {
        for (
          var _len = arguments.length,
            args = new Array(_len > 1 ? _len - 1 : 0),
            _key = 1;
          _key < _len;
          _key++
        ) {
          args[_key - 1] = arguments[_key];
        }

        var returnVals = [];
        propNames.forEach(function(propName) {
          var kapsuleInstance = state[propName];
          var returnVal = kapsuleInstance[method].apply(kapsuleInstance, args);

          if (returnVal !== kapsuleInstance) {
            returnVals.push(returnVal);
          }
        });
        return returnVals.length ? returnVals[0] : this; // chain based on the parent object, not the inner kapsule
      };
    }
  };
}

var HOVER_CANVAS_THROTTLE_DELAY = 800; // ms to throttle shadow canvas updates for perf improvement

var ZOOM2NODES_FACTOR = 4; // Expose config from forceGraph

var bindFG = linkKapsule("forceGraph", CanvasForceGraph);
var bindBoth = linkKapsule(["forceGraph", "shadowGraph"], CanvasForceGraph);
var linkedProps = Object.assign.apply(
  Object,
  _toConsumableArray(
    [
      "nodeColor",
      "nodeAutoColorBy",
      "nodeCanvasObject",
      "linkColor",
      "linkAutoColorBy",
      "linkWidth",
      "linkDirectionalArrowLength",
      "linkDirectionalArrowColor",
      "linkDirectionalArrowRelPos",
      "linkDirectionalParticles",
      "linkDirectionalParticleSpeed",
      "linkDirectionalParticleWidth",
      "linkDirectionalParticleColor",
      "dagMode",
      "dagLevelDistance",
      "d3AlphaDecay",
      "d3VelocityDecay",
      "warmupTicks",
      "cooldownTicks",
      "cooldownTime",
      "onEngineTick",
      "onEngineStop"
    ].map(function(p) {
      return _defineProperty({}, p, bindFG.linkProp(p));
    })
  ).concat(
    _toConsumableArray(
      [
        "nodeRelSize",
        "nodeId",
        "nodeVal",
        "linkSource",
        "linkTarget",
        "linkCurvature"
      ].map(function(p) {
        return _defineProperty({}, p, bindBoth.linkProp(p));
      })
    )
  )
);
var linkedMethods = Object.assign.apply(
  Object,
  _toConsumableArray(
    ["d3Force"].map(function(p) {
      return _defineProperty({}, p, bindFG.linkMethod(p));
    })
  )
);

function adjustCanvasSize(state) {
  if (state.canvas) {
    var curWidth = state.canvas.width;
    var curHeight = state.canvas.height;

    if (curWidth === 300 && curHeight === 150) {
      // Default canvas dimensions
      curWidth = curHeight = 0;
    }

    var pxScale = window.devicePixelRatio; // 2 on retina displays

    curWidth /= pxScale;
    curHeight /= pxScale; // Resize canvases

    [state.canvas, state.shadowCanvas].forEach(function(canvas) {
      // Element size
      canvas.style.width = "".concat(state.width, "px");
      canvas.style.height = "".concat(state.height, "px"); // Memory size (scaled to avoid blurriness)

      canvas.width = state.width * pxScale;
      canvas.height = state.height * pxScale; // Normalize coordinate system to use css pixels (on init only)

      if (!curWidth && !curHeight) {
        canvas.getContext("2d").scale(pxScale, pxScale);
      }
    }); // Relative center panning based on 0,0

    var k = zoomTransform(state.canvas).k;
    state.zoom.translateBy(
      state.zoom.__baseElem,
      (state.width - curWidth) / 2 / k,
      (state.height - curHeight) / 2 / k
    );
  }
}

function resetTransform(ctx) {
  var pxRatio = window.devicePixelRatio;
  ctx.setTransform(pxRatio, 0, 0, pxRatio, 0, 0);
}

function clearCanvas(ctx, width, height) {
  ctx.save();
  resetTransform(ctx); // reset transform

  ctx.clearRect(0, 0, width, height);
  ctx.restore(); //restore transforms
} //

var forceGraph = Kapsule({
  props: _objectSpread(
    {
      width: {
        default: window.innerWidth,
        onChange: function onChange(_, state) {
          return adjustCanvasSize(state);
        },
        triggerUpdate: false
      },
      height: {
        default: window.innerHeight,
        onChange: function onChange(_, state) {
          return adjustCanvasSize(state);
        },
        triggerUpdate: false
      },
      graphData: {
        default: {
          nodes: [],
          links: []
        },
        onChange: function onChange(d, state) {
          if (d.nodes.length || d.links.length) {
            console.info(
              "force-graph loading",
              d.nodes.length + " nodes",
              d.links.length + " links"
            );
          }

          [
            {
              type: "Node",
              objs: d.nodes
            },
            {
              type: "Link",
              objs: d.links
            }
          ].forEach(hexIndex);
          state.forceGraph.graphData(d);
          state.shadowGraph.graphData(d);

          function hexIndex(_ref4) {
            var type = _ref4.type,
              objs = _ref4.objs;
            objs
              .filter(function(d) {
                return !d.hasOwnProperty("__indexColor");
              })
              .forEach(function(d) {
                // store object lookup color
                d.__indexColor = state.colorTracker.register({
                  type: type,
                  d: d
                });
              });
          }
        },
        triggerUpdate: false
      },
      backgroundColor: {
        onChange: function onChange(color, state) {
          state.canvas && color && (state.canvas.style.background = color);
        },
        triggerUpdate: false
      },
      nodeLabel: {
        default: "name",
        triggerUpdate: false
      },
      linkLabel: {
        default: "name",
        triggerUpdate: false
      },
      linkHoverPrecision: {
        default: 4,
        triggerUpdate: false
      },
      enableNodeDrag: {
        default: true,
        triggerUpdate: false
      },
      enableZoomPanInteraction: {
        default: true,
        triggerUpdate: false
      },
      enablePointerInteraction: {
        default: true,
        onChange: function onChange(_, state) {
          state.hoverObj = null;
        },
        triggerUpdate: false
      },
      onNodeDrag: {
        default: function _default() {},
        triggerUpdate: false
      },
      onNodeDragEnd: {
        default: function _default() {},
        triggerUpdate: false
      },
      onNodeClick: {
        default: function _default() {},
        triggerUpdate: false
      },
      onNodeHover: {
        default: function _default() {},
        triggerUpdate: false
      },
      onLinkClick: {
        default: function _default() {},
        triggerUpdate: false
      },
      onLinkHover: {
        default: function _default() {},
        triggerUpdate: false
      }
    },
    linkedProps
  ),
  methods: _objectSpread(
    {
      centerAt: function centerAt(state, x, y, transitionDuration) {
        if (!state.canvas) return null; // no canvas yet
        // setter

        if (x !== undefined || y !== undefined) {
          var finalPos = Object.assign(
            {},
            x !== undefined
              ? {
                  x: x
                }
              : {},
            y !== undefined
              ? {
                  y: y
                }
              : {}
          );

          if (!transitionDuration) {
            // no animation
            setCenter(finalPos);
          } else {
            new TWEEN.Tween(getCenter())
              .to(finalPos, transitionDuration)
              .easing(TWEEN.Easing.Quadratic.Out)
              .onUpdate(setCenter)
              .start();
          }

          return this;
        } // getter

        return getCenter(); //

        function getCenter() {
          var t = zoomTransform(state.canvas);
          return {
            x: (state.width / 2 - t.x) / t.k,
            y: (state.height / 2 - t.y) / t.k
          };
        }

        function setCenter(_ref5) {
          var x = _ref5.x,
            y = _ref5.y;
          state.zoom.translateTo(
            state.zoom.__baseElem,
            x === undefined ? getCenter().x : x,
            y === undefined ? getCenter().y : y
          );
        }
      },
      zoom: function zoom$$1(state, k, transitionDuration) {
        if (!state.canvas) return null; // no canvas yet
        // setter

        if (k !== undefined) {
          if (!transitionDuration) {
            // no animation
            setZoom(k);
          } else {
            new TWEEN.Tween({
              k: getZoom()
            })
              .to(
                {
                  k: k
                },
                transitionDuration
              )
              .easing(TWEEN.Easing.Quadratic.Out)
              .onUpdate(function(_ref6) {
                var k = _ref6.k;
                return setZoom(k);
              })
              .start();
          }

          return this;
        } // getter

        return getZoom(); //

        function getZoom() {
          return zoomTransform(state.canvas).k;
        }

        function setZoom(k) {
          state.zoom.scaleTo(state.zoom.__baseElem, k);
        }
      },
      stopAnimation: function stopAnimation(state) {
        if (state.animationFrameRequestId) {
          cancelAnimationFrame(state.animationFrameRequestId);
        }

        return this;
      }
    },
    linkedMethods
  ),
  stateInit: function stateInit() {
    return {
      lastSetZoom: 1,
      forceGraph: new CanvasForceGraph(),
      shadowGraph: new CanvasForceGraph()
        .cooldownTicks(0)
        .nodeColor("__indexColor")
        .linkColor("__indexColor")
        .isShadow(true),
      colorTracker: new ColorTracker() // indexed objects for rgb lookup
    };
  },
  init: function init(domNode, state) {
    // Wipe DOM
    domNode.innerHTML = ""; // Container anchor for canvas and tooltip

    var container = document.createElement("div");
    container.style.position = "relative";
    domNode.appendChild(container);
    state.canvas = document.createElement("canvas");
    if (state.backgroundColor)
      state.canvas.style.background = state.backgroundColor;
    container.appendChild(state.canvas);
    state.shadowCanvas = document.createElement("canvas"); // Show shadow canvas
    //state.shadowCanvas.style.position = 'absolute';
    //state.shadowCanvas.style.top = '0';
    //state.shadowCanvas.style.left = '0';
    //container.appendChild(state.shadowCanvas);

    var ctx = state.canvas.getContext("2d");
    var shadowCtx = state.shadowCanvas.getContext("2d"); // Setup node drag interaction

    select(state.canvas).call(
      drag()
        .subject(function() {
          if (!state.enableNodeDrag) {
            return null;
          }

          var obj = state.hoverObj;
          return obj && obj.type === "Node" ? obj.d : null; // Only drag nodes
        })
        .on("start", function() {
          var obj = event.subject;
          obj.__initialDragPos = {
            x: obj.x,
            y: obj.y,
            fx: obj.fx,
            fy: obj.fy
          }; // keep engine running at low intensity throughout drag

          if (!event.active) {
            state.forceGraph.d3AlphaTarget(0.3); // keep engine running at low intensity throughout drag

            obj.fx = obj.x;
            obj.fy = obj.y; // Fix points
          } // drag cursor

          state.canvas.classList.add("grabbable");
        })
        .on("drag", function() {
          var obj = event.subject;
          var initPos = obj.__initialDragPos;
          var dragPos = event;
          var k = zoomTransform(state.canvas).k; // Move fx/fy (and x/y) of nodes based on the scaled drag distance since the drag start

          ["x", "y"].forEach(function(c) {
            return (obj["f".concat(c)] = obj[c] =
              initPos[c] + (dragPos[c] - initPos[c]) / k);
          }); // prevent freeze while dragging

          state.forceGraph.resetCountdown();
          state.onNodeDrag(obj);
        })
        .on("end", function() {
          var obj = event.subject;
          var initPos = obj.__initialDragPos;

          if (initPos.fx === undefined) {
            obj.fx = undefined;
          }

          if (initPos.fy === undefined) {
            obj.fy = undefined;
          }

          delete obj.__initialDragPos;
          state.forceGraph
            .d3AlphaTarget(0) // release engine low intensity
            .resetCountdown(); // var the engine readjust after releasing fixed nodes
          // drag cursor

          state.canvas.classList.remove("grabbable");
          state.onNodeDragEnd(obj);
        })
    ); // Setup zoom / pan interaction

    state.zoom = zoom();
    state.zoom((state.zoom.__baseElem = select(state.canvas))); // Attach controlling elem for easy access

    state.zoom
      .filter(function() {
        return state.enableZoomPanInteraction ? !event.button : false;
      }) // disable zoom interaction
      .scaleExtent([0.01, 1000])
      .on("zoom", function() {
        var t = zoomTransform(this); // Same as d3.event.transform

        [ctx, shadowCtx].forEach(function(c) {
          resetTransform(c);
          c.translate(t.x, t.y);
          c.scale(t.k, t.k);
        });
      });
    adjustCanvasSize(state);
    state.forceGraph.onFinishLoading(function() {
      // re-zoom, if still in default position (not user modified)
      if (zoomTransform(state.canvas).k === state.lastSetZoom) {
        state.zoom.scaleTo(
          state.zoom.__baseElem,
          (state.lastSetZoom =
            ZOOM2NODES_FACTOR / Math.cbrt(state.graphData.nodes.length))
        );
      }
    }); // Setup tooltip

    var toolTipElem = document.createElement("div");
    toolTipElem.classList.add("graph-tooltip");
    container.appendChild(toolTipElem); // Capture mouse coords on move

    var mousePos = {
      x: -1e12,
      y: -1e12
    };
    state.canvas.addEventListener(
      "mousemove",
      function(ev) {
        // update the mouse pos
        var offset = getOffset(container);
        mousePos.x = ev.pageX - offset.left;
        mousePos.y = ev.pageY - offset.top; // Move tooltip

        toolTipElem.style.top = "".concat(mousePos.y, "px");
        toolTipElem.style.left = "".concat(mousePos.x, "px"); //

        function getOffset(el) {
          var rect = el.getBoundingClientRect(),
            scrollLeft =
              window.pageXOffset || document.documentElement.scrollLeft,
            scrollTop =
              window.pageYOffset || document.documentElement.scrollTop;
          return {
            top: rect.top + scrollTop,
            left: rect.left + scrollLeft
          };
        }
      },
      false
    ); // Handle click events on nodes

    container.addEventListener(
      "click",
      function(ev) {
        if (state.hoverObj) {
          state["on".concat(state.hoverObj.type, "Click")](state.hoverObj.d);
        }
      },
      false
    );
    state.forceGraph(ctx);
    state.shadowGraph(shadowCtx); //

    var refreshShadowCanvas = throttle(function() {
      // wipe canvas
      clearCanvas(shadowCtx, state.width, state.height); // Adjust link hover area

      state.shadowGraph.linkWidth(function(l) {
        return accessorFn(state.linkWidth)(l) + state.linkHoverPrecision;
      }); // redraw

      var t = zoomTransform(state.canvas);
      state.shadowGraph.globalScale(t.k).tickFrame();
    }, HOVER_CANVAS_THROTTLE_DELAY); // Kick-off renderer

    (function animate() {
      // IIFE
      if (state.enablePointerInteraction) {
        // Update tooltip and trigger onHover events
        // Lookup object per pixel color
        var pxScale = window.devicePixelRatio;
        var px = shadowCtx.getImageData(
          mousePos.x * pxScale,
          mousePos.y * pxScale,
          1,
          1
        );
        var obj = px ? state.colorTracker.lookup(px.data) : null;

        if (obj !== state.hoverObj) {
          var prevObj = state.hoverObj;
          var prevObjType = prevObj ? prevObj.type : null;
          var objType = obj ? obj.type : null;

          if (prevObjType && prevObjType !== objType) {
            // Hover out
            state["on".concat(prevObjType, "Hover")](null, prevObj.d);
          }

          if (objType) {
            // Hover in
            state["on".concat(objType, "Hover")](
              obj.d,
              prevObjType === objType ? prevObj.d : null
            );
          }

          var tooltipContent = obj
            ? accessorFn(state["".concat(obj.type.toLowerCase(), "Label")])(
                obj.d
              ) || ""
            : "";
          toolTipElem.style.visibility = tooltipContent ? "visible" : "hidden";
          toolTipElem.innerHTML = tooltipContent;
          state.hoverObj = obj;
        }

        refreshShadowCanvas();
      } // Wipe canvas

      clearCanvas(ctx, state.width, state.height); // Frame cycle

      var t = zoomTransform(state.canvas);
      state.forceGraph.globalScale(t.k).tickFrame();
      TWEEN.update(); // update canvas animation tweens

      state.animationFrameRequestId = requestAnimationFrame(animate);
    })();
  },
  update: function updateFn(state) {}
});

export default forceGraph;
