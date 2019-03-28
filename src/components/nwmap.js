import React, { Component } from 'react';
import { ImageOverlay, Map, Marker, Popup } from 'react-leaflet';
import { CRS, Icon } from 'leaflet';

import MapImage from '../images/CombinedNW.png';
import { iconConstruction, iconLandmark, iconPeak } from './icons.js';
import PopUpMarker from './nwmap/PopUpMarker';


const NewMarker = props => {
    return(
        <PopUpMarker 
            icon={iconPeak}
            position={props.position}>
            <Popup>
              A new Marker!!
            </Popup>
        </PopUpMarker>
    );
};

        
class NWmap extends Component {
   constructor(){
        super();

        this.state = {
            newMarker: false,
            lat: 0,
            lng: 0,
            zoom: 0
        };
    }
    onDoubleClick = (e) => {
        console.log(e.latlng);
        
        //add a marker to the coords
        this.setState({
            newMarker: true,
            newMarkerLatLong: e.latlng
        });
        //open a config dialog
        
        //close or lose focus, save the point.
    }
    render(){
        const position = [this.state.lat, this.state.lng];
        const overstyle = {
            border: '1px solid',
            width: '100%'
        };
        const bounds = [[-500,-500],[500,500]];      
        return (
            <div style={overstyle}>
                <h4>New World</h4>
                <Map 
                    center={position}
                    zoom={this.state.zoom}
                    crs={CRS.Simple}
                    doubleClickZoom={false}
                    ondblclick={this.onDoubleClick}
                    >
                  <ImageOverlay
                    url={MapImage}
                    bounds={bounds}
                  />
                  <Marker position={position}>
                    <Popup>
                      A pretty CSS3 popup. <br /> Easily customizable.
                    </Popup>
                  </Marker>
                  {this.state.newMarker ? <NewMarker position={this.state.newMarkerLatLong} /> : null}
                </Map>
                
            </div>
        );
  }  
};
 
export default NWmap;