import React from 'react';
import { Marker } from 'react-leaflet';

//This marker starts with a popup
const PopUpMarker = props => {
    const initMarker = ref => {
        if (ref) {
            ref.leafletElement.openPopup();
        };
    };
    return <Marker ref={initMarker} {...props}/>;
};

export default PopUpMarker;
    
    
            