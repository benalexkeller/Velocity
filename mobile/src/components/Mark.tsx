// Velocity's mark: two ribbon bands forming a V and a medal below. Same geometry as the website's
// public/brand/mark.svg (the right band passes in front, with a gap around it and around the medal).
import Svg, { Circle, Defs, G, Mask, Polygon, Rect } from "react-native-svg";

const RIGHT = "839,108 1095,108 631,905 375,905";

export function Mark({ width = 76, color = "#2459FE" }: { width?: number; color?: string }) {
  return (
    <Svg width={width} height={(width * 1065) / 958} viewBox="146 100 958 1065" accessibilityLabel="Velocity">
      <Defs>
        <Mask id="vm-left" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
          <Rect width="1254" height="1254" fill="#fff" />
          <Polygon points={RIGHT} fill="#000" stroke="#000" strokeWidth={44} strokeLinejoin="miter" />
          <Circle cx="626" cy="905" r="272" fill="#000" />
        </Mask>
        <Mask id="vm-right" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
          <Rect width="1254" height="1254" fill="#fff" />
          <Circle cx="626" cy="905" r="272" fill="#000" />
        </Mask>
      </Defs>
      <G fill={color}>
        <Polygon points="155,108 411,108 874,905 618,905" mask="url(#vm-left)" />
        <Polygon points={RIGHT} mask="url(#vm-right)" />
        <Circle cx="626" cy="905" r="250" />
      </G>
    </Svg>
  );
}
