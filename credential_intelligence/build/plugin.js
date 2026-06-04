import te, { useState as gr, useEffect as _r } from "react";
import mr from "react-dom";
import { Box as Se, Typography as Er, Button as we, TableContainer as br, Paper as Rr, Table as Tr, TableHead as xr, TableRow as ke, TableCell as E, TableBody as jr, Chip as Cr, createTheme as Or, ThemeProvider as Pr, CssBaseline as Sr } from "@mui/material";
var re = { exports: {} }, I = {};
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var De;
function wr() {
  if (De) return I;
  De = 1;
  var _ = te, h = Symbol.for("react.element"), f = Symbol.for("react.fragment"), O = Object.prototype.hasOwnProperty, L = _.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, N = { key: !0, ref: !0, __self: !0, __source: !0 };
  function D(T, d, P) {
    var g, b = {}, x = null, V = null;
    P !== void 0 && (x = "" + P), d.key !== void 0 && (x = "" + d.key), d.ref !== void 0 && (V = d.ref);
    for (g in d) O.call(d, g) && !N.hasOwnProperty(g) && (b[g] = d[g]);
    if (T && T.defaultProps) for (g in d = T.defaultProps, d) b[g] === void 0 && (b[g] = d[g]);
    return { $$typeof: h, type: T, key: x, ref: V, props: b, _owner: L.current };
  }
  return I.Fragment = f, I.jsx = D, I.jsxs = D, I;
}
var $ = {};
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Fe;
function kr() {
  return Fe || (Fe = 1, process.env.NODE_ENV !== "production" && function() {
    var _ = te, h = Symbol.for("react.element"), f = Symbol.for("react.portal"), O = Symbol.for("react.fragment"), L = Symbol.for("react.strict_mode"), N = Symbol.for("react.profiler"), D = Symbol.for("react.provider"), T = Symbol.for("react.context"), d = Symbol.for("react.forward_ref"), P = Symbol.for("react.suspense"), g = Symbol.for("react.suspense_list"), b = Symbol.for("react.memo"), x = Symbol.for("react.lazy"), V = Symbol.for("react.offscreen"), ne = Symbol.iterator, Ae = "@@iterator";
    function Ie(e) {
      if (e === null || typeof e != "object")
        return null;
      var r = ne && e[ne] || e[Ae];
      return typeof r == "function" ? r : null;
    }
    var S = _.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    function v(e) {
      {
        for (var r = arguments.length, t = new Array(r > 1 ? r - 1 : 0), n = 1; n < r; n++)
          t[n - 1] = arguments[n];
        $e("error", e, t);
      }
    }
    function $e(e, r, t) {
      {
        var n = S.ReactDebugCurrentFrame, i = n.getStackAddendum();
        i !== "" && (r += "%s", t = t.concat([i]));
        var u = t.map(function(o) {
          return String(o);
        });
        u.unshift("Warning: " + r), Function.prototype.apply.call(console[e], console, u);
      }
    }
    var We = !1, Ye = !1, Le = !1, Ne = !1, Ve = !1, ae;
    ae = Symbol.for("react.module.reference");
    function Ue(e) {
      return !!(typeof e == "string" || typeof e == "function" || e === O || e === N || Ve || e === L || e === P || e === g || Ne || e === V || We || Ye || Le || typeof e == "object" && e !== null && (e.$$typeof === x || e.$$typeof === b || e.$$typeof === D || e.$$typeof === T || e.$$typeof === d || // This needs to include all possible module reference object
      // types supported by any Flight configuration anywhere since
      // we don't know which Flight build this will end up being used
      // with.
      e.$$typeof === ae || e.getModuleId !== void 0));
    }
    function Me(e, r, t) {
      var n = e.displayName;
      if (n)
        return n;
      var i = r.displayName || r.name || "";
      return i !== "" ? t + "(" + i + ")" : t;
    }
    function oe(e) {
      return e.displayName || "Context";
    }
    function R(e) {
      if (e == null)
        return null;
      if (typeof e.tag == "number" && v("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), typeof e == "function")
        return e.displayName || e.name || null;
      if (typeof e == "string")
        return e;
      switch (e) {
        case O:
          return "Fragment";
        case f:
          return "Portal";
        case N:
          return "Profiler";
        case L:
          return "StrictMode";
        case P:
          return "Suspense";
        case g:
          return "SuspenseList";
      }
      if (typeof e == "object")
        switch (e.$$typeof) {
          case T:
            var r = e;
            return oe(r) + ".Consumer";
          case D:
            var t = e;
            return oe(t._context) + ".Provider";
          case d:
            return Me(e, e.render, "ForwardRef");
          case b:
            var n = e.displayName || null;
            return n !== null ? n : R(e.type) || "Memo";
          case x: {
            var i = e, u = i._payload, o = i._init;
            try {
              return R(o(u));
            } catch {
              return null;
            }
          }
        }
      return null;
    }
    var j = Object.assign, F = 0, ie, se, ue, le, ce, fe, de;
    function ve() {
    }
    ve.__reactDisabledLog = !0;
    function Be() {
      {
        if (F === 0) {
          ie = console.log, se = console.info, ue = console.warn, le = console.error, ce = console.group, fe = console.groupCollapsed, de = console.groupEnd;
          var e = {
            configurable: !0,
            enumerable: !0,
            value: ve,
            writable: !0
          };
          Object.defineProperties(console, {
            info: e,
            log: e,
            warn: e,
            error: e,
            group: e,
            groupCollapsed: e,
            groupEnd: e
          });
        }
        F++;
      }
    }
    function qe() {
      {
        if (F--, F === 0) {
          var e = {
            configurable: !0,
            enumerable: !0,
            writable: !0
          };
          Object.defineProperties(console, {
            log: j({}, e, {
              value: ie
            }),
            info: j({}, e, {
              value: se
            }),
            warn: j({}, e, {
              value: ue
            }),
            error: j({}, e, {
              value: le
            }),
            group: j({}, e, {
              value: ce
            }),
            groupCollapsed: j({}, e, {
              value: fe
            }),
            groupEnd: j({}, e, {
              value: de
            })
          });
        }
        F < 0 && v("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
      }
    }
    var K = S.ReactCurrentDispatcher, z;
    function U(e, r, t) {
      {
        if (z === void 0)
          try {
            throw Error();
          } catch (i) {
            var n = i.stack.trim().match(/\n( *(at )?)/);
            z = n && n[1] || "";
          }
        return `
` + z + e;
      }
    }
    var G = !1, M;
    {
      var Je = typeof WeakMap == "function" ? WeakMap : Map;
      M = new Je();
    }
    function pe(e, r) {
      if (!e || G)
        return "";
      {
        var t = M.get(e);
        if (t !== void 0)
          return t;
      }
      var n;
      G = !0;
      var i = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      var u;
      u = K.current, K.current = null, Be();
      try {
        if (r) {
          var o = function() {
            throw Error();
          };
          if (Object.defineProperty(o.prototype, "props", {
            set: function() {
              throw Error();
            }
          }), typeof Reflect == "object" && Reflect.construct) {
            try {
              Reflect.construct(o, []);
            } catch (y) {
              n = y;
            }
            Reflect.construct(e, [], o);
          } else {
            try {
              o.call();
            } catch (y) {
              n = y;
            }
            e.call(o.prototype);
          }
        } else {
          try {
            throw Error();
          } catch (y) {
            n = y;
          }
          e();
        }
      } catch (y) {
        if (y && n && typeof y.stack == "string") {
          for (var a = y.stack.split(`
`), p = n.stack.split(`
`), l = a.length - 1, c = p.length - 1; l >= 1 && c >= 0 && a[l] !== p[c]; )
            c--;
          for (; l >= 1 && c >= 0; l--, c--)
            if (a[l] !== p[c]) {
              if (l !== 1 || c !== 1)
                do
                  if (l--, c--, c < 0 || a[l] !== p[c]) {
                    var m = `
` + a[l].replace(" at new ", " at ");
                    return e.displayName && m.includes("<anonymous>") && (m = m.replace("<anonymous>", e.displayName)), typeof e == "function" && M.set(e, m), m;
                  }
                while (l >= 1 && c >= 0);
              break;
            }
        }
      } finally {
        G = !1, K.current = u, qe(), Error.prepareStackTrace = i;
      }
      var k = e ? e.displayName || e.name : "", C = k ? U(k) : "";
      return typeof e == "function" && M.set(e, C), C;
    }
    function Ke(e, r, t) {
      return pe(e, !1);
    }
    function ze(e) {
      var r = e.prototype;
      return !!(r && r.isReactComponent);
    }
    function B(e, r, t) {
      if (e == null)
        return "";
      if (typeof e == "function")
        return pe(e, ze(e));
      if (typeof e == "string")
        return U(e);
      switch (e) {
        case P:
          return U("Suspense");
        case g:
          return U("SuspenseList");
      }
      if (typeof e == "object")
        switch (e.$$typeof) {
          case d:
            return Ke(e.render);
          case b:
            return B(e.type, r, t);
          case x: {
            var n = e, i = n._payload, u = n._init;
            try {
              return B(u(i), r, t);
            } catch {
            }
          }
        }
      return "";
    }
    var A = Object.prototype.hasOwnProperty, he = {}, ye = S.ReactDebugCurrentFrame;
    function q(e) {
      if (e) {
        var r = e._owner, t = B(e.type, e._source, r ? r.type : null);
        ye.setExtraStackFrame(t);
      } else
        ye.setExtraStackFrame(null);
    }
    function Ge(e, r, t, n, i) {
      {
        var u = Function.call.bind(A);
        for (var o in e)
          if (u(e, o)) {
            var a = void 0;
            try {
              if (typeof e[o] != "function") {
                var p = Error((n || "React class") + ": " + t + " type `" + o + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof e[o] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                throw p.name = "Invariant Violation", p;
              }
              a = e[o](r, o, n, t, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
            } catch (l) {
              a = l;
            }
            a && !(a instanceof Error) && (q(i), v("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", n || "React class", t, o, typeof a), q(null)), a instanceof Error && !(a.message in he) && (he[a.message] = !0, q(i), v("Failed %s type: %s", t, a.message), q(null));
          }
      }
    }
    var Xe = Array.isArray;
    function X(e) {
      return Xe(e);
    }
    function He(e) {
      {
        var r = typeof Symbol == "function" && Symbol.toStringTag, t = r && e[Symbol.toStringTag] || e.constructor.name || "Object";
        return t;
      }
    }
    function Ze(e) {
      try {
        return ge(e), !1;
      } catch {
        return !0;
      }
    }
    function ge(e) {
      return "" + e;
    }
    function _e(e) {
      if (Ze(e))
        return v("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", He(e)), ge(e);
    }
    var me = S.ReactCurrentOwner, Qe = {
      key: !0,
      ref: !0,
      __self: !0,
      __source: !0
    }, Ee, be;
    function er(e) {
      if (A.call(e, "ref")) {
        var r = Object.getOwnPropertyDescriptor(e, "ref").get;
        if (r && r.isReactWarning)
          return !1;
      }
      return e.ref !== void 0;
    }
    function rr(e) {
      if (A.call(e, "key")) {
        var r = Object.getOwnPropertyDescriptor(e, "key").get;
        if (r && r.isReactWarning)
          return !1;
      }
      return e.key !== void 0;
    }
    function tr(e, r) {
      typeof e.ref == "string" && me.current;
    }
    function nr(e, r) {
      {
        var t = function() {
          Ee || (Ee = !0, v("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", r));
        };
        t.isReactWarning = !0, Object.defineProperty(e, "key", {
          get: t,
          configurable: !0
        });
      }
    }
    function ar(e, r) {
      {
        var t = function() {
          be || (be = !0, v("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", r));
        };
        t.isReactWarning = !0, Object.defineProperty(e, "ref", {
          get: t,
          configurable: !0
        });
      }
    }
    var or = function(e, r, t, n, i, u, o) {
      var a = {
        // This tag allows us to uniquely identify this as a React Element
        $$typeof: h,
        // Built-in properties that belong on the element
        type: e,
        key: r,
        ref: t,
        props: o,
        // Record the component responsible for creating this element.
        _owner: u
      };
      return a._store = {}, Object.defineProperty(a._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: !1
      }), Object.defineProperty(a, "_self", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: n
      }), Object.defineProperty(a, "_source", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: i
      }), Object.freeze && (Object.freeze(a.props), Object.freeze(a)), a;
    };
    function ir(e, r, t, n, i) {
      {
        var u, o = {}, a = null, p = null;
        t !== void 0 && (_e(t), a = "" + t), rr(r) && (_e(r.key), a = "" + r.key), er(r) && (p = r.ref, tr(r, i));
        for (u in r)
          A.call(r, u) && !Qe.hasOwnProperty(u) && (o[u] = r[u]);
        if (e && e.defaultProps) {
          var l = e.defaultProps;
          for (u in l)
            o[u] === void 0 && (o[u] = l[u]);
        }
        if (a || p) {
          var c = typeof e == "function" ? e.displayName || e.name || "Unknown" : e;
          a && nr(o, c), p && ar(o, c);
        }
        return or(e, a, p, i, n, me.current, o);
      }
    }
    var H = S.ReactCurrentOwner, Re = S.ReactDebugCurrentFrame;
    function w(e) {
      if (e) {
        var r = e._owner, t = B(e.type, e._source, r ? r.type : null);
        Re.setExtraStackFrame(t);
      } else
        Re.setExtraStackFrame(null);
    }
    var Z;
    Z = !1;
    function Q(e) {
      return typeof e == "object" && e !== null && e.$$typeof === h;
    }
    function Te() {
      {
        if (H.current) {
          var e = R(H.current.type);
          if (e)
            return `

Check the render method of \`` + e + "`.";
        }
        return "";
      }
    }
    function sr(e) {
      return "";
    }
    var xe = {};
    function ur(e) {
      {
        var r = Te();
        if (!r) {
          var t = typeof e == "string" ? e : e.displayName || e.name;
          t && (r = `

Check the top-level render call using <` + t + ">.");
        }
        return r;
      }
    }
    function je(e, r) {
      {
        if (!e._store || e._store.validated || e.key != null)
          return;
        e._store.validated = !0;
        var t = ur(r);
        if (xe[t])
          return;
        xe[t] = !0;
        var n = "";
        e && e._owner && e._owner !== H.current && (n = " It was passed a child from " + R(e._owner.type) + "."), w(e), v('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', t, n), w(null);
      }
    }
    function Ce(e, r) {
      {
        if (typeof e != "object")
          return;
        if (X(e))
          for (var t = 0; t < e.length; t++) {
            var n = e[t];
            Q(n) && je(n, r);
          }
        else if (Q(e))
          e._store && (e._store.validated = !0);
        else if (e) {
          var i = Ie(e);
          if (typeof i == "function" && i !== e.entries)
            for (var u = i.call(e), o; !(o = u.next()).done; )
              Q(o.value) && je(o.value, r);
        }
      }
    }
    function lr(e) {
      {
        var r = e.type;
        if (r == null || typeof r == "string")
          return;
        var t;
        if (typeof r == "function")
          t = r.propTypes;
        else if (typeof r == "object" && (r.$$typeof === d || // Note: Memo only checks outer props here.
        // Inner props are checked in the reconciler.
        r.$$typeof === b))
          t = r.propTypes;
        else
          return;
        if (t) {
          var n = R(r);
          Ge(t, e.props, "prop", n, e);
        } else if (r.PropTypes !== void 0 && !Z) {
          Z = !0;
          var i = R(r);
          v("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", i || "Unknown");
        }
        typeof r.getDefaultProps == "function" && !r.getDefaultProps.isReactClassApproved && v("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
      }
    }
    function cr(e) {
      {
        for (var r = Object.keys(e.props), t = 0; t < r.length; t++) {
          var n = r[t];
          if (n !== "children" && n !== "key") {
            w(e), v("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", n), w(null);
            break;
          }
        }
        e.ref !== null && (w(e), v("Invalid attribute `ref` supplied to `React.Fragment`."), w(null));
      }
    }
    var Oe = {};
    function Pe(e, r, t, n, i, u) {
      {
        var o = Ue(e);
        if (!o) {
          var a = "";
          (e === void 0 || typeof e == "object" && e !== null && Object.keys(e).length === 0) && (a += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.");
          var p = sr();
          p ? a += p : a += Te();
          var l;
          e === null ? l = "null" : X(e) ? l = "array" : e !== void 0 && e.$$typeof === h ? (l = "<" + (R(e.type) || "Unknown") + " />", a = " Did you accidentally export a JSX literal instead of a component?") : l = typeof e, v("React.jsx: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", l, a);
        }
        var c = ir(e, r, t, i, u);
        if (c == null)
          return c;
        if (o) {
          var m = r.children;
          if (m !== void 0)
            if (n)
              if (X(m)) {
                for (var k = 0; k < m.length; k++)
                  Ce(m[k], e);
                Object.freeze && Object.freeze(m);
              } else
                v("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
            else
              Ce(m, e);
        }
        if (A.call(r, "key")) {
          var C = R(e), y = Object.keys(r).filter(function(yr) {
            return yr !== "key";
          }), ee = y.length > 0 ? "{key: someKey, " + y.join(": ..., ") + ": ...}" : "{key: someKey}";
          if (!Oe[C + ee]) {
            var hr = y.length > 0 ? "{" + y.join(": ..., ") + ": ...}" : "{}";
            v(`A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`, ee, C, hr, C), Oe[C + ee] = !0;
          }
        }
        return e === O ? cr(c) : lr(c), c;
      }
    }
    function fr(e, r, t) {
      return Pe(e, r, t, !0);
    }
    function dr(e, r, t) {
      return Pe(e, r, t, !1);
    }
    var vr = dr, pr = fr;
    $.Fragment = O, $.jsx = vr, $.jsxs = pr;
  }()), $;
}
process.env.NODE_ENV === "production" ? re.exports = wr() : re.exports = kr();
var s = re.exports, Y = {}, W = mr;
if (process.env.NODE_ENV === "production")
  Y.createRoot = W.createRoot, Y.hydrateRoot = W.hydrateRoot;
else {
  var J = W.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  Y.createRoot = function(_, h) {
    J.usingClientEntryPoint = !0;
    try {
      return W.createRoot(_, h);
    } finally {
      J.usingClientEntryPoint = !1;
    }
  }, Y.hydrateRoot = function(_, h, f) {
    J.usingClientEntryPoint = !0;
    try {
      return W.hydrateRoot(_, h, f);
    } finally {
      J.usingClientEntryPoint = !1;
    }
  };
}
const Dr = () => {
  const [_, h] = gr([]);
  return _r(() => {
    h([
      { id: 1, tool: "brutus", target: "http://example.com/login", status: "completed", credentials_found: 2 },
      { id: 2, tool: "netexec", target: "smb://192.168.1.0/24", status: "running", credentials_found: 0 },
      { id: 3, tool: "hashcat", target: "hashes.txt", status: "pending", credentials_found: 0 }
    ]);
  }, []), /* @__PURE__ */ s.jsxs(Se, { sx: { p: 3 }, children: [
    /* @__PURE__ */ s.jsxs(Se, { sx: { display: "flex", justifyContent: "space-between", mb: 3 }, children: [
      /* @__PURE__ */ s.jsx(Er, { variant: "h4", children: "Credential Intelligence" }),
      /* @__PURE__ */ s.jsx(we, { variant: "contained", color: "primary", children: "New Task" })
    ] }),
    /* @__PURE__ */ s.jsx(br, { component: Rr, children: /* @__PURE__ */ s.jsxs(Tr, { children: [
      /* @__PURE__ */ s.jsx(xr, { children: /* @__PURE__ */ s.jsxs(ke, { children: [
        /* @__PURE__ */ s.jsx(E, { children: "Task ID" }),
        /* @__PURE__ */ s.jsx(E, { children: "Tool" }),
        /* @__PURE__ */ s.jsx(E, { children: "Target" }),
        /* @__PURE__ */ s.jsx(E, { children: "Status" }),
        /* @__PURE__ */ s.jsx(E, { children: "Credentials Found" }),
        /* @__PURE__ */ s.jsx(E, { children: "Actions" })
      ] }) }),
      /* @__PURE__ */ s.jsx(jr, { children: _.map((f) => /* @__PURE__ */ s.jsxs(ke, { children: [
        /* @__PURE__ */ s.jsx(E, { children: f.id }),
        /* @__PURE__ */ s.jsx(E, { children: f.tool }),
        /* @__PURE__ */ s.jsx(E, { children: f.target }),
        /* @__PURE__ */ s.jsx(E, { children: /* @__PURE__ */ s.jsx(
          Cr,
          {
            label: f.status,
            color: f.status === "completed" ? "success" : f.status === "running" ? "primary" : "default",
            size: "small"
          }
        ) }),
        /* @__PURE__ */ s.jsx(E, { children: f.credentials_found }),
        /* @__PURE__ */ s.jsx(E, { children: /* @__PURE__ */ s.jsx(we, { size: "small", children: "View" }) })
      ] }, f.id)) })
    ] }) })
  ] });
};
function Fr() {
  return /* @__PURE__ */ s.jsx("div", { children: /* @__PURE__ */ s.jsx(Dr, {}) });
}
const Ar = Or({
  palette: {
    mode: "dark",
    primary: { main: "#00f3ff" },
    secondary: { main: "#00ff62" },
    background: { default: "#07070c", paper: "#0d0d14" }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif'
  }
});
function Ir(_) {
  const h = document.getElementById(_);
  h ? Y.createRoot(h).render(
    /* @__PURE__ */ s.jsx(te.StrictMode, { children: /* @__PURE__ */ s.jsxs(Pr, { theme: Ar, children: [
      /* @__PURE__ */ s.jsx(Sr, {}),
      /* @__PURE__ */ s.jsx(Fr, {})
    ] }) })
  ) : console.error(`Container ${_} not found`);
}
window.plugin_credential_intelligence_render = Ir;
export {
  Ir as default
};
