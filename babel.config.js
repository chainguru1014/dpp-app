module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  // class-properties is NOT listed here -- metro-react-native-babel-preset
  // already applies it (loose: true, same as this file used to redundantly
  // re-specify). Running the same class-transform plugin twice over the same
  // class syntax is a known source of subtle corruption in the compiled
  // output; it's the likely cause of a real, reproduced-on-device crash
  // where a class component (react-native's own FlatList) received
  // `this.props === undefined` in its constructor despite React always
  // setting it via `super(props)`. private-methods/private-property-in-object
  // stay here since the preset doesn't include either of those.
  plugins: [
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
  ],
};
