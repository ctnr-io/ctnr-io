// react-native-web passes className through to the DOM for Tailwind; the side-effect import keeps this a module so SvgProps merges instead of being replaced.
import 'react-native-svg'

declare module 'react-native-svg' {
  interface SvgProps {
    className?: string
  }
}
