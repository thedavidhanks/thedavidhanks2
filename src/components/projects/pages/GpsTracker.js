import React from 'react';
import Container from 'react-bootstrap/Container';
import Carousel from 'react-bootstrap/Carousel'

import gpsbox from './slides/gps1.png';
import gpsmap from './slides/gps2.png';


const GpsTracker = (props) => {
    return(
    <Container>
        <h3>GPS Tracker</h3>
        <p>This project was built to track my wife 
        and I as we travelled across the United States.  An arduino with a gps 
        module sends current coordinates to a mySQL database which are then 
        displayed on the React web page <a href="http://www.margeeanddave.com/whereintheworld/">www.margeeanddave.com/whereintheworld/</a>
        </p>
        <Container className="carouselContainer w-50">
          <Carousel className="">
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={gpsbox}
                alt="Project Box"
              />
              <Carousel.Caption>
                <h3>Project Box</h3>
                <p>An outside view of the project box with LED indicators</p>
              </Carousel.Caption>
            </Carousel.Item>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={gpsmap}
                alt="Website"
              />

              <Carousel.Caption>
                <h3>Website</h3>
                <p>The website frontend displays a cricket icon at our current 
                location</p>
              </Carousel.Caption>
            </Carousel.Item>
          </Carousel>
        </Container>
        
          <h5>The Details</h5>
          <p>The GPS tracker consists of several elements:
          <ul>
            <li>Open-source hardware</li>
            <li>Backend PHP server</li>
            <li>Backend mySQL database</li>
            <li>Backend mySQL database</li>
            <li>Backend mySQL database</li>
            <li>Front-end React website</li>
            <li>Backend Firestore database</li>
            <li>Backend Node.js server</li>
          </ul>
          <b>Open-source hardware</b>  (<a href="https://github.com/thedavidhanks/arduinoCricketGPS" target="_blank" rel="noopener noreferrer">gps tracker repo</a>
          )- At the core of the 
            hardware is an Arduino NodeMCU board with integrated ESP8266 chip.  
            The arduino reads coordinates from a connected gps module and sends 
            a post request to a PHP server.
            <br />
            <b>Backend PHP server</b> -(
            <a href="https://github.com/thedavidhanks/tdh-scripts" target="_blank" rel="noopener noreferrer">tdh-scripts 
            repo</a>) The php server 
            receives a post request.  If the gps coordinates are in a new 
            location, the PHP server will add a new row to the  mySQL database.  
            When a new point is added, the PHP server utilizes a mapQuest API 
            to generate a driving path which is stored in a JSON file.  
            (assuming the maximum API requests have not been used for the month).
            <br />
            <b>Front-end React website</b> - 
            (<a href="http://www.margeeanddave.com/whereintheworld" target="_blank" rel="noopener noreferrer">link</a>)
            (<a href="https://github.com/thedavidhanks/mad" target="_blank" rel="noopener noreferrer">website repo</a>) 
            The frontend
            website utilizes an open-source map library called Leaflet to 
            overlay a current location marker and a travel path on a map.  
            The location marker is updated every 30 seconds, so viewers can see 
            when we are moving.  The location marker also has a pop-up 
            displaying the last seen time and the weather if available.
          </p>
          <h5>Issues and Future Plans</h5>
          <p><b>JSON file to Firestore:</b> At present when a new point is added via a POST request to the backend PHP server
          , a JSON file is updated.  However, when the server restarts, Heroku 
          restores the server from the latest git commit which undoes any updates
          created by the PHP server.  My plan is to store this JSON file in a 
          noSQL JSON-like database (like Firestore), then request the contents from the database 
          rather than from a file.</p>
          <p><b>MapQuest API to Google Directions API: </b>During testing and development, I have exceeded the number of free requests
          allowed by the Mapquest API, therefore I intend to persue a cheaper option.  Google Directions 
          API seems like an economical solution.</p>
          <p><b>PHP server to Node.js:</b> Switching from PHP to Node.js provides 
          a few advantages:<ul>
            <li>Firestore supports NodeJS fully.  This will allow me to create 
            promises to watch the database for updates, rather than continually
            querying the db through an AJAX call to the PHP server</li>
            <li><b>Common Developer</b>Utilizng Firestore, FirebaseUI, & 
            Directions API all from Googleprovides a bit of commonality which 
            should share a common code base/philosophy, ideally improve 
            responsiviness, 
            and hopefully prevent the need for custom solutions. </li>
          
            </ul>
            </p>
    </Container>
    );
};

export default GpsTracker;