import React from 'react';
import { Marker } from 'react-leaflet';

//This marker's popup is displayed when placed.
const PopUpMarker = props => {
    const initMarker = ref => {
        if (ref) {
            ref.leafletElement.openPopup();
        };
    };
    return <Marker ref={initMarker} {...props}/>;
};

export default PopUpMarker;
    
    
            