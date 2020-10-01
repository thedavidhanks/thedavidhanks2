import React from 'react';
import Container from 'react-bootstrap/Container';
import Carousel from 'react-bootstrap/Carousel';

import diagram from './slides/cell-diagram.png';
import deployed1 from './slides/cell-deploy1.JPG';
import enclosure1 from './slides/cell-enclosure1.jpg';
import enclosure2 from './slides/cell-enclosure2.jpg';

const CricketAntenna = (props) => {
    
    
    return(
    <Container>
        <h3>Project Name</h3>
        <p>short description</p>
        
        <Carousel className="carouselContainer w-50">
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={deployed1}
                alt="Deployed in Grand Teton NP."
              />
              <Carousel.Caption>
                <h3>Deployed</h3>
                <p>Cricket Antenna deployed in Grand Teton NP.</p>
              </Carousel.Caption>
            </Carousel.Item>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={enclosure1}
                alt="inside the box"
              />

              <Carousel.Caption>
                <h3>The Enclosure Guts</h3>
                <p>A view of the inside</p>
              </Carousel.Caption>
            </Carousel.Item>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={enclosure2}
                alt="inside the box2"
              />

              <Carousel.Caption>
                <h3>Enclosure Close-up</h3>
                <p>A closer view of the inside</p>
              </Carousel.Caption>
            </Carousel.Item>
          </Carousel>
          <h5>section title</h5>
          <p>words</p>
          
        <h5>Improvements</h5>
        <p>words</p>
    </Container>
    );
};

export default CricketAntenna;