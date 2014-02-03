## Synopsis

This loosely termed **Gumball** project consists of all my work at the **University of Queensland - CEIT Building** during my summer electrical engineering vocational work experience placement.

My brief was simple. To get a previous summer students project operational, it consisted of a 3D printed gumball machine. The purpose of this machine was to read a student card tapped on a RFID Card receiver and dispense a small amount of lollies to that student.

After getting the basic functionality working i just kinda kept implementing different things.

- New gumball machine firmware using MQTT and new motor driver code to drive an Archimedes screw.
- Node.js web server to allow user to register and select permissions for different devices that i tie into the system.
- Management system incorporated into the web server to allow a person with elevated permissions to change other users details or delete them.
- Python shell script hybrid for scanning and publishing the **hashed** user RFID Card ID to be used by all components of the system.
- Generic python scripts to grab the published MQTT data and perform an action on it, depending if it is register or unregisters.
- Python script to control a 3.2 inch LED screen to give feedback to users.
- An automated time sheet system, so users who scan can see the hours they spend in that building.

## Motivation

The reason behind this project is because RFID is really cool, and i wanted to see how far i could push it, i have barely scratched the surface of what is possible with this technology. 

## Installation

You will need.

A Server Computer with

A MQTT Server
```
(Debian) sudo apt-get install mosquitto.
(Mac) brew install mosquitto
```

A Redis Server
```
wget http://download.redis.io/releases/redis-2.8.4.tar.gz
tar xzf redis-2.8.4.tar.gz
cd redis-2.8.4
make
./src/redis-server
```

Node.js
```
(Debian) sudo apt-get install node
(Mac) http://nodejs.org/dist/v0.10.25/node-v0.10.25.pkg
```

3.1 Node Dependencies
```
sudo npm install path
sudo npm install http
sudo npm install fs
sudo npm install querystring
sudo npm install redis
```

Each Scanner requires a Raspberry Pi with

Python and PIP
```
https://raw.github.com/pypa/pip/master/contrib/get-pip.py
sudo python ./get-pip.py
```

4.1 Python Dependencies
```
sudo pip install mosquitto
sudo pip install redis
pylcdsysinfo (dangardner)
https://github.com/dangardner/pylcdsysinfo
```

## Tests

- Start all the Mosquitto and Redis servers on the server machine.
- Connect the Violet Mirror RFID Card scanner to the raspberry pi (it may change its name in /dev depending on what else is currently plugged in, check this before proceeding).
- Navigate to /Gumball/Mirror\ USB/for\ Pi/shell/ run mirror_osx.sh then scan a card. if the Mirror makes a sound and a string is printed, your golden, you should also use ia92 to check that the message is publishing correctly to "rfid".
- Navigate to /Gumball/Mirror\ USB/for\ Pi/shell/Python/ run all the python scripts to test dependencies.
- Set these scripts to run automatically using Supervisord (Google it)
- Navigate to /Gumball/nodestuff run node ./app.js (you should get a message that the server is now listening on port 55671)
- Use a web browser to navigate to "Server IP:55671/index.html" (you should see the CEIT RFID Tag main page)

## Contributors

Feel free to edit and play around with my code. If you end up using this for anything, let me know. any issues create an issue report or log an error with me.

## License

See LICENSE.txt