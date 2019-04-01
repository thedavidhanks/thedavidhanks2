import React, { Component } from 'react';
import { ImageOverlay, Map, Marker, Popup } from 'react-leaflet';
import { CRS } from 'leaflet';
import firebase, { db } from '../firebase';

import MapImage from '../images/CombinedNW.png';
import { iconPeak, iconLandmark, iconConstruction } from './icons.js';
import PopUpMarker from './nwmap/PopUpMarker';

var fs_mapPoints = db.collection('/Games/PM2ahWu01w0wb5KQcoV8/Points');
fs_mapPoints.get().then((points) =>{
    points.forEach( (point) =>{
        console.log(point.data()); 
    });
});

function iconFromType(type){
    switch(type){
        case 'stone':
            return iconPeak;
        case 'wood':
            return iconLandmark;
        default:
            return iconConstruction;       
    }
}
const NewMarker = props => {
    return(
        <PopUpMarker 
            icon={iconPeak}
            position={props.position}>
            <Popup>
              <form onSubmit={props.handleSubmit}>
                <input type="text" name="newType" placeholder="What is this?" onChange={props.handleChange} value={props.newType} />
                <input type="text" name="newNotes" placeholder="What are you bringing ?" onChange={props.handleChange} value={props.newNotes} />
                <button>Save</button>
              </form>
            </Popup>
        </PopUpMarker>
    );
};

const MarkerList = props =>{
    //props.markers will be an array of marker objects
    
    //cycle through each element of the array.
    const markerlist = props.markers.map((marker, index) =>
        //console.log(marker);
        <Marker icon={iconFromType(marker.type)} key={index} position={marker.latlong}><Popup>{marker.type}: {marker.notes}</Popup></Marker>
    );
    return markerlist;
};
        
class NWmap extends Component {
   constructor(){
        super();

        this.state = {
            newMarker: false,
            newType: '',
            newNotes: '',
            lat: 0,
            lng: 0,
            zoom: 0,
            newMarkerLatLong: {},
            markers: [
                {
                addedBy: "dave",
                addedOn: "April 1, 2019",
                type: "stone",
                notes: 'stone here',
                latlong: [156, -377]},
                {
                type: "wood",
                notes: 'big wood',
                latlong: [20, -238.875]},
                {
                type: "default",
                notes: 'small wood',
                latlong: [30, -209.625]}
            ]                
            };
        };
    handleSubmit = (e) => {
        e.preventDefault();
        var user = firebase.auth().currentUser;
        var newPoint = {
            addedBy: user.email,
            type: this.state.newType,
            notes: this.state.newNotes,
            latLong: {lat: this.state.newMarkerLatLong.lat, lng: this.state.newMarkerLatLong.lng}
        };
        //{ Lat: 100, Lng: -100 }
        //latlong: this.state.newMarkerLatLong
        var fs_mapPoints = db.collection('/Games/PM2ahWu01w0wb5KQcoV8/Points');
        fs_mapPoints.add(newPoint).then( (docRef) => {console.log("Document written with ID: ", docRef.id);});
        this.setState({
            newMarker: false,
            newType: '',
            newNotes: ''
        })
        
    };
    handleChange = (e) => {
        this.setState({
        [e.target.name]: e.target.value
    });
}
    onDoubleClick = (e) => {
        console.log(e.latlng);
        
        //show a new marker at the coords
        this.setState({
            newMarker: true,
            newMarkerLatLong: e.latlng
        });
        //close or lose focus, save the point.
    };
    render(){
        const position = this.state.markers[1].latlong;//[this.state.lat, this.state.lng];
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
                  {this.state.newMarker ? <NewMarker position={this.state.newMarkerLatLong} handleSubmit={this.handleSubmit} handleChange={this.handleChange} newNotes={this.state.newNotes} newType={this.state.newType}/> : null}
                  {this.state.markers ? <MarkerList markers={this.state.markers} /> : null}
                </Map>
            </div>
        );
  }  
};
 
export default NWmap;