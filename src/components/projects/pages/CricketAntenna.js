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
        <h3>Cricket Antenna</h3>
        <p>This is a design I created out of need for internet access while travellin 
        in remote locations.  This antenna offers two methods of wireless connection: cellular and 
        WiFi (802.11x).  The two connection options operate independently of each
        other.  This allows the user to choose whichever signal is better for the
        location.</p>
        
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
          <h5>Diagram</h5>
          <img className="w-50" src={diagram} alt="antenna diagram" />
          <h5>Bill of Material</h5>
            <ol>
                <li><a href="https://www.amazon.com/gp/product/B00J14YEHQ/ref=ppx_yo_dt_b_search_asin_title?ie=UTF8&psc=1">Wilson Antenna</a> 50 Ohm, qty 2.</li>
                <li><a href="https://www.amazon.com/gp/product/B07NV739RK/ref=ppx_yo_dt_b_search_asin_title?ie=UTF8&psc=1">Antenna Mast</a>, qty 1.</li>
                <li><a href="https://www.amazon.com/gp/product/B078MKN8V3/ref=ppx_yo_dt_b_asin_title_o07_s00?ie=UTF8&psc=1">N-Male Extension</a>, qty 2</li>
                <li>Cat 6 network cable 30'</li>
                <li>Ubiquiti NanoStation M2(NSM2US)</li>
                <li><a href="https://www.amazon.com/dp/B07PK6ZDST/ref=cm_sw_em_r_mt_dp_r8AvFbQME1Q61">8.7 x 6.7 x 4.3" project box</a></li>
                <li><a href="https://www.amazon.com/gp/product/B07LBRK94Q/ref=ppx_yo_dt_b_search_asin_title?ie=UTF8&psc=1">N-Female to TS9 Male</a> adapter, qty 2</li>
                <li><a href="https://www.amazon.com/dp/B07V317BYF/ref=cm_sw_em_r_mt_dp_laBvFb3CQW62X">Cat6 RJ45 Shielded industrial panel mount</a>, qty 1</li>
                <li><a href="https://www.amazon.com/dp/B07LBRK94Q/ref=cm_sw_em_r_mt_dp_rhBvFbQBSMQW8">N-Male Bulkhead to TS9 female adapater</a> qty 2</li>
                <li><a href="https://www.amazon.com/dp/B07LDZF3ZR/ref=cm_sw_em_r_mt_dp_5iBvFbX9BCDDD">5.5x2.5MM DC Power Plug</a>, qty 1</li>
                <li>14ga-ish power wires</li>
                <li><a href="https://www.amazon.com/dp/B00HXT84UO/ref=cm_sw_em_r_mt_dp_xmBvFbD6CKTBX">Ubiquiti Networks AirGateway-LR Wireless AP</a></li>
                <li><a href="https://www.amazon.com/dp/B00X6BRR8I/ref=cm_sw_em_r_mt_dp_MnBvFb5BN3K8H">Power Over Ethernet adapter </a>, qty 1</li>
                <li>Hotspot with TS9 external cable connectors, like a MiFi 8800L, qty 1</li>
                <li><a href="https://www.amazon.com/dp/B07SS6XTZY/ref=cm_sw_em_r_mt_dp_gpBvFbCC8Q0MX">USB Charging Module</a>, qty 1</li>
                <li>Power connector cable.</li>
                <li>USB charging cable from (15) to (14), qty 1</li>
            </ol>
        <h5>Installation Notes</h5>
        <ul>
            <li>The cellular antenna is equipped with two MiMo 50Ohm directional 
        antenna that feature up to +10.6 dB gain. - Mount the two Wilson 
        antennas 90 deg to each other for a Mult-In Multi-Out antenna. </li>
        <li>This is pretty much all the cell antenna parts,  
        <a href="https://www.waveform.com/products/mimo-log-periodic-hotspot-external-antennas?utm_medium=cpc&utm_source=googlepla&variant=32471367712871&gclid=CjwKCAjw0_T4BRBlEiwAwoEiAYcBoa90c_CyWV0bfZO5S8jwXQ29In9nt4vvGKwhTLxdW6K_8VyEVhoC6b0QAvD_BwE">(link)</a>
        Not sure if it's cheaper/faster, but it may be.  It's also an example of how the antennas should be arranged.</li>
            <li>There may be some benefit in moving the control box (X) closer to the antenna array.
            I would expect less loss of signal with shorter antenna cables.
            The device would also look much cleaner with 1 power cable going up the pole
            instead of 3 (2 antenna & 1 CAT 6).  The 
            downside with this approach is the MiFi 8800L has a tendency to overheat
            without ventalation, so a need exists to open the box occasionally.  
            B) I had orignally tried this on top of a 30' painter's pole; 
            The arranment was akin to balancing a bolwing ball on a spaghetti noodle.
            It was quite the circus act to errect and eventually ended as you might expect.</li>
            <li>Power to the Cricket Antenna is supplied via a 12V source.  Generally this is
        in the form of a car battery. </li>
        
            
        </ul>
        <h5>Improvements</h5>
        <p>This arrangement isn't perfect and there is quite a bit of room from 
        improvement.  If you decide to mimic this, I'd offer the following suggestions:</p>
        <ul>
            <li>Add ventalation to the box.  Most mornings the MiFi will shut down 
            by 11am because it was too hot.  I haven't done a heat analysis to see if active
            cooling is necessary, though I susepect it'll depend on the climate.</li>
            <li>In 6 months, I haven't had much use for the wifi extender.  
            It supposedly has a 5 mile range, however finding an open access point within 
            line of sight is not as common as you might think.  Therefore I feel 
            that it may be better to split the cellular antenna from the wifi.  
            </li>
        </ul>
        
    </Container>
    );
};

export default CricketAntenna;