import React, { Component } from 'react';
import { ImageOverlay, Map, Marker, Popup } from 'react-leaflet';
import { CRS } from 'leaflet';
import MapImage from '../images/CombinedNW.png';
//import MapImage from '../images/FNmap.jpg';

class NWmap extends Component {
   constructor(){
        super();

        this.state = {
            lat: 0,
            lng: 0,
            zoom: 2
        };
    }
    onDoubleClick = (e) => {
        console.log(e.latlng);
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
                    dblclick={this.onDoubleClick}
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
                </Map>
                
            </div>
        );
  }  
};
 
export default NWmap;