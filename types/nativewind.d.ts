import 'react-native';

/** NativeWind's React Native prop augmentation, shared across every workspace package. */
declare module 'react-native' {
  interface ViewProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface TextProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface ImagePropsBase {
    className?: string;
    cssInterop?: boolean;
  }

  interface TextInputProps {
    className?: string;
    placeholderClassName?: string;
  }

  interface ScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
  }
}
