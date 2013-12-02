#!/usr/bin/python
 
import mosquitto
import os
import time
 
# globals  
global debug

# mqtt
broker = "winter.ceit.uq.edu.au"
port = 1883

# callback
def on_message(mosq, obj, msg):

    if(debug):
    	print("Message received: "+msg.payload)
    	print (":".join("{0:x}".format(ord(c)) for c in msg.payload))
    
    myid = msg.payload[0:9]
    hexstring = (":".join("{0:x}".format(ord(c)) for c in myid))
    print "ID: " + hexstring

    mqttc.publish("ait", hexstring)

# start
debug = 0

mypid = os.getpid()
client_uniq = "pubclient_"+str(mypid)
mqttc = mosquitto.Mosquitto(client_uniq)
 
#connect to broker
mqttc.connect(broker, port)

mqttc.publish("gumballlog", "RFID Parser Connected")
mqttc.subscribe("gumballrfid", 0)
mqttc.on_message = on_message
 
#remain connected and publish
while mqttc.loop() == 0:
    print "loop"
    time.sleep(1)