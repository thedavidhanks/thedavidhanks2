import React from 'react';
import Container from 'react-bootstrap/Container';
import Carousel from 'react-bootstrap/Carousel';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

import assemblydrawing from './slides/kaleidoscope/AssemblyDrawing.png';
import assemblyrender from './slides/kaleidoscope/FinalRender.jpg';

let caraselTextStyle = {'backgroundColor': "rgba(52, 52, 52, 0.4)",
                    'borderRadius':'5px'};
const Kaleidoscope = (props) => {

    return(
    <Container>
        <h3>Kaleidoscope</h3>
        <p>I created this small kaleidoscope as a wedding present for my wife in 2017.  The project had many iterations and took about a year.  I sourced the parts, 
          created CNC paths, and printed the 3d parts.
        </p>

        <Container className="carouselContainer w-50">
          <Carousel className="">
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={assemblydrawing}
                alt="assembly drawing"
              />
              <Carousel.Caption>
                <div  style={caraselTextStyle}>
                <h3>Assembly drawing</h3>
                <p>A drawing of the kaleidoscope generated with Fusion 360.</p>
                </div>
              </Carousel.Caption>
            </Carousel.Item>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={assemblyrender}
                alt="3d render of assembly"
              />
              <Carousel.Caption>
                <div  style={caraselTextStyle}>
                <h3>Rendering</h3>
                <p>A 3d rendering of the final product created in Fusion 360.</p>
                </div>
              </Carousel.Caption>
            </Carousel.Item>
          </Carousel>
        </Container>
    </Container>
    );
};

export default Kaleidoscope;