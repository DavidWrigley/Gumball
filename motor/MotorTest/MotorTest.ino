// Adafruit Motor shield library
// copyright Adafruit Industries LLC, 2009
// this code is public domain, enjoy!

#include <AFMotor.h>
#define SWITCH_PIN 2

AF_DCMotor motor(1);
int incomingByte = 0;

void setup() {
  Serial.begin(9600);           // set up Serial library at 9600 bps
  Serial.println("Motor test!");
  pinMode(2, INPUT);
}

void loop() {
  
  motor.run(FORWARD);
  
  if(digitalRead(SWITCH_PIN)) {    
    motor.setSpeed(100);
    Serial.println("Motor Running");
  } 
  else {
    Serial.println("Motor Stop");
    motor.setSpeed(0);
  }
}
