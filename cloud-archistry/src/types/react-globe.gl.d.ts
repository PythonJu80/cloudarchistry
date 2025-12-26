declare module "react-globe.gl" {

  interface GlobeProps {
    // Globe appearance
    globeImageUrl?: string;
    bumpImageUrl?: string;
    backgroundImageUrl?: string;
    showGlobe?: boolean;
    showAtmosphere?: boolean;
    atmosphereColor?: string;
    atmosphereAltitude?: number;

    // Points
    pointsData?: object[];
    pointLat?: string | ((d: object) => number);
    pointLng?: string | ((d: object) => number);
    pointColor?: string | ((d: object) => string);
    pointAltitude?: string | ((d: object) => number);
    pointRadius?: string | ((d: object) => number);
    pointsMerge?: boolean;
    onPointClick?: (point: object, event: MouseEvent) => void;
    onPointHover?: (point: object | null, prevPoint: object | null) => void;

    // Arcs
    arcsData?: object[];
    arcStartLat?: string | ((d: object) => number);
    arcStartLng?: string | ((d: object) => number);
    arcEndLat?: string | ((d: object) => number);
    arcEndLng?: string | ((d: object) => number);
    arcColor?: string | ((d: object) => string | string[]);
    arcAltitude?: string | ((d: object) => number);
    arcAltitudeAutoScale?: number;
    arcStroke?: string | ((d: object) => number);
    arcCurveResolution?: number;
    arcCircularResolution?: number;
    arcDashLength?: number;
    arcDashGap?: number;
    arcDashAnimateTime?: number;

    // Rings
    ringsData?: object[];
    ringLat?: string | ((d: object) => number);
    ringLng?: string | ((d: object) => number);
    ringAltitude?: number;
    ringColor?: string | ((d: object) => string);
    ringMaxRadius?: string | ((d: object) => number);
    ringPropagationSpeed?: string | ((d: object) => number);
    ringRepeatPeriod?: string | ((d: object) => number);

    // Labels
    labelsData?: object[];
    labelLat?: string | ((d: object) => number);
    labelLng?: string | ((d: object) => number);
    labelText?: string | ((d: object) => string);
    labelSize?: string | ((d: object) => number);
    labelColor?: string | ((d: object) => string);

    // Dimensions
    width?: number;
    height?: number;

    // Animation
    animateIn?: boolean;

    // Ref methods
    pointOfView?: (pov: { lat?: number; lng?: number; altitude?: number }, transitionMs?: number) => void;
    controls?: () => {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableZoom: boolean;
      minDistance: number;
      maxDistance: number;
    };
  }

  interface GlobeInstance {
    pointOfView: (pov?: { lat?: number; lng?: number; altitude?: number }, transitionMs?: number) => { lat: number; lng: number; altitude: number };
    controls: () => {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableZoom: boolean;
      minDistance: number;
      maxDistance: number;
      getDistance: () => number;
      addEventListener: (event: string, callback: () => void) => void;
      removeEventListener: (event: string, callback: () => void) => void;
    };
  }

  const Globe: React.ForwardRefExoticComponent<GlobeProps & React.RefAttributes<GlobeInstance>>;
  export default Globe;
  export type { GlobeInstance };
}
