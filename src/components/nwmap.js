import React, { Component } from 'react';
import { ImageOverlay, Map, Marker, Popup, CRS } from 'react-leaflet';
import NWtileMap from '../images/CombinedNW.png';

class NWmap extends Component {
   constructor(){
        super();

        this.state = {
            lat: 0,
            lng: 0,
            zoom: 2
        };
    }   
    render(){
        const position = [this.state.lat, this.state.lng];
        const overstyle = {
            border: '1px solid',
            width: '100%'
        };
        const bounds = [[-500,-500],[500,500]];
        const mapBounds = [[-200,-200],[200,200]];
        return (
            <div style={overstyle}>
                <h4>New World</h4>
                <Map 
                    center={position}
                    zoom={this.state.zoom}
                    >
                  <ImageOverlay
                    url={NWtileMap}
                    bounds={bounds}
                  />
                  <Marker position={position}>
                    <Popup>
                      A pretty CSS3 popup. <br /> Easily customizable.
                    </Popup>
                  </Marker>
                </Map>
                
            </div>
        );
  }  
};
 
export default NWmap;