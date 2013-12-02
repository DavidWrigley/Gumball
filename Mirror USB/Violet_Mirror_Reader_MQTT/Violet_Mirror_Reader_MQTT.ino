/*
 * MAX3421E USB Host controller Violet Mirror demonstration.
 
 * This code works with the Violet Mir:ror smart card reader.
 * The project is described in brief at:
 *  http://www.fact4ward.com/blog/rfid8/violet-mirror/
 * The code comes from the URL:
 *  http://www.fact4ward.com/wordpress322/software/Violet_Mirror_6.pde
 * It requires the USB host card from circuitsonline.com
 *
 * Uploaded and reformatted by M Schulz Nov 20, 2012
 */
/*--------------------------------------------------------------------------------------
  Includes
--------------------------------------------------------------------------------------*/
#include <SPI.h>
#include <Ethernet.h>
#include <PubSubClient.h>
#include <Max3421e.h>
#include <Usb.h>

/* Violet Mirror data taken from configuration descriptor */
#define MIRROR_ADDR        1
#define MIRROR_EP          1
#define MIRROR_IF          0
#define EP_MAXPKTSIZE   0x40
#define EP_POLL         0x10

#define MQTT_ID "ceitMirror01"
#define IN_TOPIC "/CEIT/mirror/1/input"
#define OUT_TOPIC "/CEIT/mirror/1/data"
#define LOG_TOPIC "/CEIT/mirror/1/log"

/*--------------------------------------------------------------------------------------
  Variables
--------------------------------------------------------------------------------------*/
byte mac[]    = {  0x00, 0x22, 0x19, 0xe1, 0xe8, 0x8d };
byte server[] = { 130, 102, 129, 175 };  // winter.ceit.uq.edu.au

char buf[EP_MAXPKTSIZE] = { 0 };      //Violet Mirror buffer

int led = 13;

MAX3421E Max;
USB Usb;

EP_RECORD ep_record[ 2 ];  //endpoint record structure for the keyboard

void callback(char *topic, byte *payload, unsigned int length)
{
  Serial.print("Callback: ");
  Serial.println((char *)payload);
}

EthernetClient ethClient;

PubSubClient client(server, 1883, callback, ethClient);

void pubData(char *msg);

void setup()
{
  Serial.begin(9600);
  static char IPstring[80];

  // start DHCP
  pinMode(led, OUTPUT); 
  Serial.print("DHCP Starting");
  while(Ethernet.begin(mac) == 0) {
    digitalWrite(led, HIGH);
    Serial.println("No DHCP yet... retrying");
    Serial.flush();
    delay(1000);
    digitalWrite(led,LOW);
  }

  Serial.println("\nDHCP Done!");
  Serial.flush();

  // DHCP finished, print results
  Serial.print("\nIP Address: ");
  sprintf(IPstring, "%u.%u.%u.%u", Ethernet.localIP()[0], Ethernet.localIP()[1], Ethernet.localIP()[2], Ethernet.localIP()[3]);
  Serial.println(IPstring);

  // pub on topics  
  if (client.connect("NFC_Reader")) {
    client.publish("aot","NFC_Reader Subscribed to MQTT Topic");
  }

}

void loop()
{
  Max.Task();
  Usb.Task();
  if( Usb.getUsbTaskState() == USB_STATE_CONFIGURING ) {  //wait for addressing state
    MIRROR_init();
    Usb.setUsbTaskState( USB_STATE_RUNNING );
  }
  if( Usb.getUsbTaskState() == USB_STATE_RUNNING )  //poll the keyboard  
    MIRROR_poll();

  client.loop();
}
/* Initialize Violet Mirror */
void MIRROR_init( void )
{
  byte rcode = 0;  //return code
  /* Initialize data structures */
  ep_record[ 0 ] = *( Usb.getDevTableEntry( 0,0 ));  //copy endpoint 0 parameters
  ep_record[ 1 ].MaxPktSize = EP_MAXPKTSIZE;
  ep_record[ 1 ].Interval  = EP_POLL;
  ep_record[ 1 ].sndToggle = bmSNDTOG0;
  ep_record[ 1 ].rcvToggle = bmRCVTOG0;
  Usb.setDevTableEntry( 1, ep_record );              //plug MIRROR.endpoint parameters to devtable
  /* Configure device */
  rcode = Usb.setConf( MIRROR_ADDR, 0, 1 );                    
  if( rcode ) {
    Serial.print("Error attempting to configure Violet Mirror. Return code :");
    Serial.println( rcode, HEX );
    while(1)
      ;  //stop
  }
  /* Set boot protocol */
  rcode = Usb.setProto( MIRROR_ADDR, 0, 0, 0 );
  if( rcode ) {
    Serial.print("Error attempting to configure boot protocol. Return code :");
    Serial.println( rcode, HEX );
    while( 1 )
      ;  //stop
  }
  Serial.println("Violet Mirror initialized");
}

/* Poll Violet Mirror and print result */
void MIRROR_poll( void )
{
  char i;
  byte rcode = 0;     //return code
  char msgBuf[EP_MAXPKTSIZE] = { 0 };  //last poll
  char *msgBufPtr;

  /* poll Violet Mirror */
  rcode = Usb.inTransfer( MIRROR_ADDR, MIRROR_EP, 0x40, buf );
  if (buf[i] == 0 ) { 
    char msg1[10] = { 0x1F, 0x01, 0x25, 0x00, 0xC4, 0x00, 0x25, 0x03 };
    char msg2[10] = { 0x00, 0x01, 0x25, 0x00, 0xC4, 0x00, 0x25, 0x04 }; 
    char msg3[] = { 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x25, 0x05 };

    rcode = Usb.outTransfer( MIRROR_ADDR, MIRROR_EP, 0x08, msg1 );    
    rcode = Usb.outTransfer( MIRROR_ADDR, MIRROR_EP, 0x08, msg2 );     
    delay(500);
    rcode = Usb.outTransfer( MIRROR_ADDR, MIRROR_EP, 0x08, msg3 ); 
    //Serial.print(".");   
    return; 
  } // return if nothing happened
  if (buf[0] == 0x2) {
    msgBuf[0] = '2';
    if (buf[1] == 0x1) {
      msgBuf[1] = '1';
      Serial.println("Placed on");
    } else if (buf[1] == 0x2) {
      msgBuf[1] = '2';
      Serial.println("Taken off");
    }
    msgBuf[3] = ' ';
    Serial.print(buf[0],HEX);
    Serial.print(buf[1],HEX);Serial.print(" ");// ==1 for placed on ==2 for taken off
    Serial.print(buf[4],HEX);Serial.print(" ");// == no of bytes in label 4 or 8
    msgBuf[4] = buf[4] + '0';
    msgBuf[5] = ' ';
    msgBufPtr = &msgBuf[6];
    for( i=5 ; i < EP_MAXPKTSIZE ; i++ ) {
      if( buf[ i ] == 0 )
        break;  //end of non-empty space
      if ( buf[i] < EP_POLL && buf[i] > 0)
        Serial.print("0");
      Serial.print((buf[i] & 0xFF),HEX);Serial.print(" ");
      *msgBufPtr++ = ((buf[i] & 0xF0) >> 4) + '0';
      *msgBufPtr++ = (buf[i] & 0x0F) + '0';
      *msgBufPtr = '0';
    }
    Serial.print("Display card: ");Serial.println(msgBuf);
    pubData(msgBuf);
    Serial.println();
  } else if (buf[0] == 0x1) {
    if (buf[1] == 4) {
      Serial.println("Based turned face up");
      pubData("Based turned face up");
    } else if (buf[1] == 0x5) {
      Serial.println("Base turned face down");
      pubData("Base turned face down");
    } else
      Serial.println("Unrecognized inerface 1 response");
  } 
  /*
   * Ignore all other things
   */
 }

void pubData(char *msg)
{
  if (!client.connected()) {
    Serial.println("trying to connect");
    if (client.connect(MQTT_ID)) {
      client.publish(LOG_TOPIC, "I'm alive!");
      Serial.println("I'm alive!");
      client.subscribe(IN_TOPIC);
    } else {
      Serial.println("Will try to connect later");
      delay(1000);
      return;
    }
  }
  client.publish("ait", msg);
}
 
