from subprocess import Popen, PIPE
import time


time.sleep(20)
Username = "davidwr1"
Password = "Wrigley"

scpt = '''
tell application "System Events"
	#keystroke tab
	#keystroke (ASCII character 8)
	#keystroke tab
	#keystroke (ASCII character 8)
	#keystroke return
	#delay 0.5
	#keystroke tab
	keystroke ''' + "\"" + Username + '''\"
	#delay 0.5
	#keystroke tab
	#delay 0.5
	#keystroke ''' + "\"" + Password + '''\"
	#delay 0.5
	#keystroke return
	#keystroke return
	#keystroke return
	keystroke return
end tell
eof
'''
args = ['3', '2']
p = Popen(['osascript', '-'] + args, stdin=PIPE, stdout=PIPE, stderr=PIPE)
stdout, stderr = p.communicate(scpt)
print (p.returncode, stdout, stderr)

