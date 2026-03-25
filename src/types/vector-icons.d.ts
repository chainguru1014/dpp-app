declare module 'react-native-vector-icons/MaterialIcons' {
  import { Component } from 'react';
  import { TextProps, StyleProp, TextStyle } from 'react-native';

  export interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
  }

  export default class Icon extends Component<IconProps> {}
}
