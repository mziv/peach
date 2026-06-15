// Manual mock for @expo/vector-icons used in Jest.
//
// The real package pulls in expo-font -> expo-asset, which is not resolvable
// at the top level of this worktree's node_modules layout, so importing the
// real icons crashes the test environment. Components only need the icon to
// render as an inert element under test, so we substitute a lightweight
// component for every named icon set.
const React = require("react");

const makeIcon = (name) => {
  const Icon = (props) => React.createElement(name, props, props.children);
  Icon.displayName = name;
  return Icon;
};

module.exports = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === "__esModule") return true;
      return makeIcon(String(prop));
    },
  }
);
