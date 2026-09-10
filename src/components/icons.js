 import L from 'leaflet'; 
 import constructionIcon from '../images/map-icons/construction.png';
 import landmarkIcon from '../images/map-icons/landmark.png';
 import peakIcon from '../images/map-icons/peak.png';

 
 export const iconConstruction = new L.Icon({
    iconUrl: constructionIcon,
    iconSize: [32, 14],
    iconAnchor: [16, 7],
    popupAnchor: [0, -14],
    tooltipAnchor: [16, 14]
});

 export const iconLandmark = new L.Icon({
    iconUrl: landmarkIcon,
    iconSize: [32, 32],
    iconAnchor: [16, 0],
    popupAnchor: [16, 32],
    tooltipAnchor: [16, 32]
});

 export const iconPeak = new L.Icon({
    iconUrl: peakIcon,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    tooltipAnchor: [16, 32]
});