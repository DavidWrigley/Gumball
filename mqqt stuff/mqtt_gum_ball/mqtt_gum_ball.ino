// **** Headers **** //

#include <SPI.h>
#include <Ethernet.h>
#include <PubSubClient.h>
#include <EEPROM.h>

// **** Defines **** //

#define SWITCH_PIN 2

// **** Globals **** //

// IP //
byte mac[]    = {  0x90, 0xA2, 0xDA, 0x00, 0x00, 0x05 };
byte server[] = { 130, 102, 129, 175 };
EthernetClient ethClient;

// mqtt // 
static char topic[80];
static char clientId[80];

// General //
int led = 13;
int motorSwitch = 0;
const int MSG_LEN = 80;
long randNumber;
String strPayload;

// **** Prototypes **** //

void callback(char* topic, byte* payload, unsigned int length);

// **** Callback Functions **** //

PubSubClient client(server, 1883, callback, ethClient);

// **** Callback **** //

// callback for message received on arduinoInTopic
void callback(char* topic, byte* payload, unsigned int length) {

	Serial.print("got:");

	int number = 0;

	payload[length] = '\0';
	String strPayload = String((char*)payload);
	Serial.println(strPayload);

        Serial.print("of length: ");
        Serial.println(length);

        // dont let mark get any
	if((strPayload.equals("2:1:0:0:4:ed:99:ba:49"))) {
		// if it matches a certain thing, do not dispense
		randNumber = 0;
	}
	else if(length) {
		// else, dispense, randomly
		randNumber = random(300);
	} 
	else {
		client.publish("gumballlog","GumBall: Incompatable Message");
	} 

	// convert to an int
	motorSwitch = (int) randNumber;
        randNumber = 0;

	// some debugging
	Serial.print("Dispensing: ");
	Serial.println(motorSwitch);
}

void setup()
{
	// setup Pin
	pinMode(SWITCH_PIN, OUTPUT);
	digitalWrite(SWITCH_PIN, LOW);

	// initilise all the stuff
	Serial.begin(9600);
	static char IPstring[80];

	// start DHCP
	pinMode(led, OUTPUT); 
	Serial.print("DHCP Starting");
	while(Ethernet.begin(mac) == 0) {
		digitalWrite(led, HIGH);
		Serial.print("No DHCP yet... retrying");
		delay(1000);
		digitalWrite(led,LOW);
	}

	// DHCP finished, print results
	Serial.print("\nIP Address: ");
	sprintf(IPstring, "%u.%u.%u.%u", Ethernet.localIP()[0], Ethernet.localIP()[1], Ethernet.localIP()[2], Ethernet.localIP()[3]);
	Serial.println(IPstring);

	// sub and pub on topics  
	if (client.connect("GumBall")) {
		client.publish("gumballlog","GumBall Connected");
		client.subscribe("ait");
	}
}

void loop()
{
	// check that connection to the mqqt server is live
	if(!client.connected()) {
		if(!client.connect("arduinoClient1234")) {
			delay(1000);
			return;
		}
	}

	// loop mqtt
	client.loop();

	if(motorSwitch) {
		digitalWrite(SWITCH_PIN, HIGH);
		delay((motorSwitch*10) + 250) ;
		motorSwitch = 0;
	} else {
		digitalWrite(SWITCH_PIN, LOW);
	}
}

