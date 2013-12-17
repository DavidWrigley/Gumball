import mosquitto
from pylcdsysinfo import LCDSysInfo, TextLines, TextLines, BackgroundColours, TextColours, TextAlignment

global mqttc
global d

# mqtt
broker = "winter.ceit.uq.edu.au"
port = 1883

# screen
bg = BackgroundColours.BLACK
fg = TextColours.GREEN

# connect
def connect():
	global mqttc
	mqttc.reinitialise()
	mqttc.connect(broker, port, 20, True)
	mqttc.publish("gumballlog", "Screen Re-Connected")
	mqttc.subscribe("gumballscreen", 0)
	mqttc.on_message = on_message
	mqqtc.on_disconnect = on_disconnect

# callback
def on_message(mosq, obj, msg):

	# grab globals
	global mqqtc
	global d

	# generate String
	my_str = ""

	# set screen parameters
	d.clear_lines(TextLines.ALL, bg)
	d.dim_when_idle(False)
	d.set_brightness(127)
	d.save_brightness(127, 255)
	d.set_text_background_colour(bg)

	# pull out the message
	my_str = msg.payload

	# go through the string till you hit a return
	# then print that line, so i can format it to look exact
	# each time
	prev_n = 0;
	lineCount = 0;
	for n in range(0,len(msg.payload)):
		if(my_str[n] == '\n'):
			d.display_text_on_line(lineCount+1, my_str[prev_n:n], False, TextAlignment.CENTRE, TextColours.CYAN)
			print my_str[prev_n:n]
			prev_n = n
			lineCount += 1

# if disconnnect, reconnect
def on_disconnect():
	connect()

# generate client name and connect to mqtt
mypid = os.getpid()
client_uniq = "pubclient_"+str(mypid)

# connect mqtt
mqttc = mosquitto.Mosquitto(client_uniq)
connect()

# not needed, want to start the screen black with a simple message.
d = LCDSysInfo()
d.clear_lines(TextLines.ALL, bg)
d.dim_when_idle(False)
d.set_brightness(127)
d.save_brightness(127, 255)
d.set_text_background_colour(bg)

d.display_text_on_line(int(n)+1, "Ready", False, TextAlignment.CENTRE, TextColours.CYAN)

#remain connected and publish
while True:
	try:
		if(mqttc.loop() != 0):
			print "Re-Connecting"
			connect()
		else:
			print "loop"

	except Exception, e:
		print "error"
		
	time.sleep(1)