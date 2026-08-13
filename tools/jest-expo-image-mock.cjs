const React = require('react');
const { Image: NativeImage } = require('react-native');

const Image = React.forwardRef(function ExpoImageMock(
  { contentFit: _contentFit, transition: _transition, ...props },
  ref,
) {
  return React.createElement(NativeImage, { ...props, ref });
});

module.exports = { Image };
