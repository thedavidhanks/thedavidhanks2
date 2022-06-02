import React from 'react';
import Container from 'react-bootstrap/Container';
import Carousel from 'react-bootstrap/Carousel';

import assemblydrawing from './slides/kaleidoscope/AssemblyDrawing.png';
import assemblyrender from './slides/kaleidoscope/FinalRender.jpg';

let pic_realAssembly='https://tdh-public-files.s3.us-east-2.amazonaws.com/images/FinalKscope.jpeg'; 
let pic_realAssembly2='https://tdh-public-files.s3.us-east-2.amazonaws.com/images/FinalKscope2.jpeg'; 
let caraselTextStyle = {'backgroundColor': "rgba(52, 52, 52, 0.4)",
                    'borderRadius':'5px'};
const Kaleidoscope = (props) => {

    return(
    <Container>
        <h3>Kaleidoscope</h3>
        <p>I created this small kaleidoscope as a wedding present for my wife in 2017.  The project had many iterations and took about a year.  I sourced the parts, 
          created CNC paths, designed the electroincs and custom switches, CNC'd the wood, and printed the 3d parts.</p>
        <p>The Kaleidoscope is a 3 mirror system design.  That is the view is a refleciton of the object chamber into 3 mirrors.  The body is made of pecan wood from my back yard. 
          The object chamber filled with glycol and bits of glass from a local stain glass maker who lived two doors down from me.  The body is so short to accomodate the vertical
          travel of a CNC router.  As a result the eye piece was required to be a convex lens with a 40 mm focal length.  The light source is unique in that it is internal.  
          Traditionally, a kaleidoscope's object is lit with natural light.  This kaleidoscope has 3 internal RGB LEDs that osciallate colors.  The effect is an everchaning 
          colorful lightshow behind the floating bits of glass.</p>
        <p><a href="https://youtu.be/X2K3H9HXA5g" target="_blank" rel="noopener noreferrer">View of the show</a></p>

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
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={pic_realAssembly}
                alt="final assembled product"
              />
              <Carousel.Caption>
                <div  style={caraselTextStyle}>
                <h3>Final</h3>
                <p>The result</p>
                </div>
              </Carousel.Caption>
            </Carousel.Item>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={pic_realAssembly2}
                alt="inside final assembled product"
              />
              <Carousel.Caption>
                <div  style={caraselTextStyle}>
                <h3>Guts</h3>
                <p>A view of inside the final product</p>
                </div>
              </Carousel.Caption>
            </Carousel.Item>
          </Carousel>
        </Container>
    </Container>
    );
};

export default Kaleidoscope;