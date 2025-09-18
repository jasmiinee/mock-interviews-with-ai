import React, { useState, useEffect, useRef } from "react";
import Toolbar from "src/components/Toolbar/Toolbar";
import styles from "@/styles/Console.module.css";
import Prompt from "src/components/Dropdown/Prompt";

function Console({
  textInput: textInput,
  setTextInput: setTextInput,
  detectionSettings: detectionSettings,
  setDetectionSettings: setDetectionSettings,
  activityDetection: activityDetection,
  setActivityDetection: setActivityDetection,
  currentAIAudio: scurrentAIAudio,
  setCurrentAIAudio: setCurrentAIAudio,
  sessionTurn: sessionTurn,
  setSessionTurn: setSessionTurn,
  playQueue: playQueue,
  setPlayQueue: setPlayQueue,
  userMediaStream: userMediaStream,
  setUserMediaStream: setUserMediaStream,
  currentAudio: currentAudio,
  setCurrentAudio: setCurrentAudio,
  audioRefs: audioRefs,
  sessionMessages: sessionMessages,
  currentSession: currentSession,
  promptOpen: promptOpen,
  setPromptOpen: setPromptOpen,
  rerender: rerender,
  selectedPrompt: selectedPrompt,
  setRerender: setRerender,
  micQuiet: micQuiet,
  resetPlaceholderPrompt: resetPlaceholderPrompt,
  preprocessedJobDescription: preprocessedJobDescription,
  setPreprocessedJobDescription: setPreprocessedJobDescription,
  interviewSettings: interviewSettings,
}) {
  // browser voices for Web Speech API
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voiceNames, setVoiceNames] = useState({
    label: "Browser Voice",
    options: [
      {
        label: "Default",
        value: "default",
      },
    ]
  });
  
  const voiceId = useRef("default");

  // load browser voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      const voiceOptions = voices.map((voice, index) => ({
        label: `${voice.name} (${voice.lang})`,
        value: voice.name,
      }));

      setVoiceNames({
        label: "Browser Voice",
        options: [
          {
            label: "Default",
            value: "default",
          },
          ...voiceOptions,
        ],
      });
      setAvailableVoices(voices);
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // text to speech function by web
  function speakText(text, onEnd) {
    if ('speechSynthesis' in window) {
      // cancel any ongoing speech
      speechSynthesis.cancel();
      // set the voice
      const utterance = new SpeechSynthesisUtterance(text);
      if (voiceId.current !== "default" && availableVoices.length > 0) {
        const selectedVoice = availableVoices.find(voice => voice.name === voiceId.current);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      // speech parameters
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      // handle speech end
      utterance.onend = onEnd;
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        if (onEnd) onEnd();
      }

      // speak the text
      speechSynthesis.speak(utterance);
    } else {
      console.warn('Speech synthesis not supported');
      if (onEnd) onEnd();
    }
  }

  function handleTextSubmit(event) {
    event.preventDefault();

    if (currentSession.current != null) {
      currentSession.current.insertMessage("user", event.target[0].value);
      currentSession.current.process();
    }

    event.target[0].value = "";

    if (currentSession.current == null) {
      currentSession.current = interview();
      currentSession.current.insertMessage("user", textInput);
      currentSession.current.process();
    }

    return false;
  }

  function handleMicrophoneSubmit(event) {
    event.preventDefault();

    if (currentSession.current == null) {
      currentSession.current = interview();
      currentSession.current.recorder.record();
    } else {
      if (activityDetection == 0) {
        currentSession.current.recorder.record();
      }
    }
    setRerender(rerender + 1);
  }

  function resetPrompt() {
    const { personalityOptions, questionTypes, feedback } =
      interviewSettings.current;
    let interviewerPersonality = "";
    let interviewerQuestions = "";

    // Construct prompt based on interview settings
    let interviewerPrompt =
      "You are a job interview partner, assisting someone in preparing for their upcoming job interview. Your task is to simulate a realistic job interview experience.";

    if (feedback) {
      interviewerPrompt +=
        " Provide constructive feedback on the candidate's answers, offer suggestions for improvement, and discuss techniques for effective communication.";
    } else {
      interviewerPrompt +=
        " Do not provide constructive feedback or suggestions for improvement on the candidate's answers. Stay focused on a realistic interview simulation.";
    }

    const enabledPersonalities = personalityOptions.filter(
      (option) => option.enabled
    );
    if (enabledPersonalities.length > 0) {
      const personalities = enabledPersonalities.map((option) =>
        option.value.toLowerCase()
      );
      const personalityStr = personalities.join(", ");
      interviewerPersonality = `Your personality type is ${personalityStr}.`;
    } else {
      interviewerPersonality =
        "Warm, friendly, and encouraging. You are a supportive and helpful interviewer.";
    }

    const enabledQuestionTypes = questionTypes.filter(
      (option) => option.enabled
    );
    if (enabledQuestionTypes.length > 0) {
      const questionTypeLabels = enabledQuestionTypes.map((option) =>
        option.label.toLowerCase()
      );
      const questionTypeStr = questionTypeLabels.join(", ");
      const disabledQuestionTypes = questionTypes
        .filter((option) => !option.enabled)
        .map((option) => option.label.toLowerCase());
      let negativeQuestions = "";
      if (disabledQuestionTypes.length > 0) {
        negativeQuestions = ` Do not ask ${disabledQuestionTypes.join(
          ", "
        )} questions.`;
      }
      interviewerQuestions = `Ask ${questionTypeStr} questions.${negativeQuestions}`;
    } else {
      interviewerQuestions = "";
    }

    let jobDescription = preprocessedJobDescription;
    if (jobDescription.length == 0) {
      jobDescription =
        "\nBlank, kindly remind the user to follow complete instructions and then ask the user for a job description";
    }

    const prompt = [
      {
        role: "system",
        content: `${interviewerPrompt} ${interviewerPersonality} ${interviewerQuestions} Limit your responses to 3 sentences. Do not respond with lists or ask multiple questions at once. End every response with a question to keep the conversation going. You are interviewing a candidate for the following position:\n${jobDescription}.`,
      },
    ];

    sessionMessages.current = prompt;
    setRerender(rerender + 1);
    return prompt;
  }

  function interview() {
    // Set the activity detection to 0, meaning that the microphone is not listening for activity
    setActivityDetection(0);

    // Reset the prompt
    resetPrompt();

    // Setup features to abandon the session
    const controller = new AbortController();
    const signal = controller.signal;

    let stopped = false;
    let interval;

    function insertMessage(role, content) {
      sessionMessages.current.push({ role: role, content: content });
      setTextInput("");
    }

    // Recorder holds and processes state for the record requests
     const recorderInstance = () => {
      let currentRecording = null;

      function record() {
        if (stopped) {
          stop();
          return;
        }
        setActivityDetection(1);
        if(currentRecording != null){
          clear();
        }
        currentRecording = collectAudio();
      }

      function clear() {
        if (currentRecording != null) {
          currentRecording.cancel();
          currentRecording = null;
        }
      }

      return {
        record: record,
        clear: clear,
      };
    };

    const recorder = recorderInstance();

    function stop() {
      stopped = true;
      if (interval != null) {
        clearInterval(interval);
      }
      controller.abort();
    }

    function process(audio) {
      setActivityDetection(3);
      // Create a placeholder for the anticipated AI recording
      let userRecordingIndex;

      if (audio != null) {
        // Create a placeholder for the user's recording
        userRecordingIndex = sessionMessages.current.push({
          role: "user",
          content: "",
          loading: true,
        });
      }

      // Create a placeholder for the AI's recording
      let AIRecordingIndex = sessionMessages.current.push({
        role: "assistant",
        content: "",
        loading: true,
      });

      // Fetch
      try {
        fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            voiceId: voiceId.current,
            audio: audio ? audio : null,
            messages: (() => {
              // remove audio from sessionMessages.current
              let messages = [];
              for (let i = 0; i < sessionMessages.current.length; i++) {
                if (sessionMessages.current[i].content.length > 0) {
                  messages.push({
                    role: sessionMessages.current[i].role,
                    content: sessionMessages.current[i].content,
                  });
                }
              }
              return messages;
            })(),
          }),
          signal, // Pass the signal option to the fetch request
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("Network response was not ok");
            }
            return response.json();
          })
          .then((response) => {
            if (stopped) {
              stop();
              return;
            }
            
            console.log("Successfully received response:", response);
            console.log("Response messages:", response.messages);
            console.log("Last message content:", response.messages[response.messages.length - 1]?.content);
            console.log("AIRecordingIndex:", AIRecordingIndex);
            console.log("audio is null:", audio === null);
            
            if (audio != null) {
              // For audio input, update both user transcription and AI response
              console.log("Processing audio input");
              sessionMessages.current[userRecordingIndex - 1].loading = false;
              sessionMessages.current[userRecordingIndex - 1].content =
                response.messages[response.messages.length - 2].content;
              sessionMessages.current[AIRecordingIndex - 1].loading = false;
              sessionMessages.current[AIRecordingIndex - 1].content =
                response.messages[response.messages.length - 1].content;
            } else {
              // For text input, only update the AI response
              // The user message was already added by insertMessage before process() was called
              console.log("Processing text input");
              console.log("Before update - AI message:", sessionMessages.current[AIRecordingIndex - 1]);
              sessionMessages.current[AIRecordingIndex - 1].loading = false;
              sessionMessages.current[AIRecordingIndex - 1].content =
                response.messages[response.messages.length - 1].content;
              console.log("After update - AI message:", sessionMessages.current[AIRecordingIndex - 1]);
            }
            sessionMessages.current[AIRecordingIndex - 1].audio =
              response.audio;
            sessionMessages.current[AIRecordingIndex - 1].onEnded = turnUser;
            const messageIndex = AIRecordingIndex - 1;
            // playAudio(messageIndex, turnUser); // Temporarily commented out - function not defined
            setCurrentAIAudio(messageIndex);
            console.log("Calling setRerender, current rerender value:", rerender);
            setRerender(rerender + 1);
            console.log("setRerender called, new value should be:", rerender + 1);
          })
          .catch((error) => {
            console.log("Error: ", error.message);
            if (stopped) {
              stop();
              return;
            }
            if (audio != null) {
              sessionMessages.current[userRecordingIndex - 1].loading = false;
              sessionMessages.current[userRecordingIndex - 1].content =
                "Error, failed to process transcription";
            }
            sessionMessages.current[AIRecordingIndex - 1].loading = false;
            sessionMessages.current[AIRecordingIndex - 1].content =
              "Error, failed to retrieve response";
            setRerender(rerender + 1);
          });
      } catch (error) {
        if (stopped) {
          stop();
          return;
        }
        console.log("Error: ", error.message);
        if (audio != null) {
          sessionMessages.current[userRecordingIndex - 1].loading = false;
          sessionMessages.current[userRecordingIndex - 1].content =
            "Error, failed to process transcription";
        }
        sessionMessages.current[AIRecordingIndex - 1].loading = false;
        sessionMessages.current[AIRecordingIndex - 1].content =
          "Error, failed to retrieve response";
        setRerender(rerender + 1);
      }
    }

    function turnUser() {
      if (stopped) {
        stop();
        return;
      }
      if (detectionSettings.current.activityDetection) {
        recorder.record();
      } else {
        setActivityDetection(0);
      }
    }

    function collectAudio() {
      if (stopped) {
        stop();
        return;
      }
      //collectAudio controls the mic behavior, it enables and sits and waits for the user to begin talking

      setActivityDetection(1);

      let mediaRecorder;
      let audioChunks = [];
      let recording = false;
      let stoppedTalking = false;
      let stoppedTalkingInterval = 0;
      const autoEndTimer = 45000;
      let recordingInterval = 0;
      let source;
      let gainNode;
      let analyzer;
      let bufferLength;
      let dataArray;
      const audioContext = new AudioContext();
      gainNode = audioContext.createGain();
      analyzer = audioContext.createAnalyser();
      // Below is the audio stream from the mic, this represents a possible way of checking if the user enabled the mic + the inform the user of a disabled mic
      source = audioContext.createMediaStreamSource(userMediaStream);
      source.connect(gainNode);
      gainNode.connect(analyzer);
      bufferLength = analyzer.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      mediaRecorder = new MediaRecorder(userMediaStream, {
        mimeType: "audio/webm",
      });
      mediaRecorder.addEventListener("dataavailable", (event) => {
        audioChunks = [...audioChunks, event.data];
      });

      mediaRecorder.addEventListener("stop", async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        audioChunks = [];
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async function () {
          const base64audio = reader.result;
          clearInterval(interval);
          process(base64audio);
        };
      });

      interval = setInterval(() => {
        analyzer.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((acc, val) => acc + val) / bufferLength;

        // The user can talk, so start recording if they are talking - voice activity detection

        if (volume > detectionSettings.current.activityDetectionThreshold) {
          if (!recording) {
            recording = true;
            mediaRecorder.start();
            setActivityDetection(2);
            console.log("Start recording, substantial audio detected");
          } else {
            console.log("User is currently talking");
            recordingInterval += 100;
            if (recordingInterval > autoEndTimer) {
              console.log(
                "User has been talking for too long, stopping recording"
              );
              recordingInterval = 0;
              recording = false;
              mediaRecorder.stop();
              setActivityDetection(0);
            }
          }
        } else {
          console.log("No audio detected.");
          if (recording) {
            stoppedTalking = true;
            stoppedTalkingInterval += 100;
            console.log("User is not currently talking");
          }
          if (stoppedTalking && stoppedTalkingInterval > micQuiet.current) {
            recording = false;
            stoppedTalking = false;
            stoppedTalkingInterval = 0;
            mediaRecorder.stop();
            setActivityDetection(0);
            console.log("Stopped recording, user has stopped talking");
          }
        }
      }, 100);

      // return an object with a cancel method
      return {
        cancel: () => {
          clearInterval(interval);
          mediaRecorder.stop();
        },
      };
    }

    return {
      stop: stop,
      recorder: recorder,
      insertMessage: insertMessage,
      process: process,
    };
  }

  const handleInputChange = (event) => {
    setTextInput(event.target.value);
  };

  const scrollableRef = useRef(null);

  // scroll to bottom of div
  if (scrollableRef.current !== null) {
    scrollableRef.current.scrollTop = scrollableRef.current.scrollHeight;
  }

  return (
    <div>
      <div className={styles.Console}>
        <Prompt
          selectedPrompt={selectedPrompt}
          promptOpen={promptOpen}
          setPromptOpen={setPromptOpen}
          rerender={rerender}
          setRerender={setRerender}
          preprocessedJobDescription={preprocessedJobDescription}
          setPreprocessedJobDescription={setPreprocessedJobDescription}
        ></Prompt>
        <div ref={scrollableRef} className={styles.InnerConsole}>
          {sessionMessages.current.map((message, index) => {
            if (message.role === "welcome") {
              return (
                <div className={styles.Message} key={index}>
                  <span className={styles.SystemText}>
                    Introduction: Prepare for your mock interview session with
                    AI!
                    <br></br>
                    <ul>
                      <li>
                        1. Choose your interviewer settings (voice,
                        personality). <i>optional</i>
                      </li>
                      <li>
                        2. Paste the job description in the prompt menu.{" "}
                        <i>required</i>
                      </li>
                      <li>
                        3. Introduce yourself (by text or click the microphone
                        to start speaking). <i>required</i>
                      </li>
                    </ul>
                  </span>
                </div>
              );
            }

            if (message.role === "user") {
              return (
                <div className={styles.Message} key={index}>
                  <span className={styles.UserText}>
                    {message.loading ? (
                      <span>
                        <i>Your message is being transcribed.</i>
                      </span>
                    ) : (
                      <>User:&nbsp;{message.content}</>
                    )}
                  </span>
                </div>
              );
            }

            if (message.role === "assistant") {
              return (
                <div className={styles.Message} key={index}>
                  <span className={styles.AssistantText}>
                    {message.loading ? (
                      <i>Interviewer's response is being generated.</i>
                    ) : (
                      <>Interviewer:&nbsp;{message.content}</>
                    )}
                  </span>
                </div>
              );
            }

            if (message.role === "system") {
              return (
                <div className={styles.Message} key={index}>
                  <span className={styles.SystemText}>
                    <i>
                      Prompt:&nbsp;
                      {message.loading ? (
                        <span>
                          <span className="ellipsis"></span>
                        </span>
                      ) : (
                        <>{message.content}</>
                      )}
                    </i>
                  </span>
                </div>
              );
            }
          })}
        </div>

        <form
          onSubmit={handleTextSubmit}
          style={{
            position: "absolute",
            borderTop: "1px solid var(--mauve9)",
            width: "100%",
            bottom: "0px",
            display: "flex",
            alignItems: "center",
            background: "var(--mauve12)",
          }}
        >
          <input
            placeholder="Type here..."
            type="text"
            id="input"
            name="input"
            disabled={activityDetection === 2}
            onChange={handleInputChange}
            style={{
              color: "var(--mauve6)",
              border: "none",
              outline: "none",
              flexGrow: "1",
            }}
          />
        </form>
      </div>

      <Toolbar
        activityDetection={activityDetection}
        handleMicrophoneSubmit={handleMicrophoneSubmit}
        currentSession={currentSession}
        detectionSettings={detectionSettings}
        setDetectionSettings={setDetectionSettings}
        voiceNames={voiceNames}
        voiceId={voiceId}
        selectedPrompt={selectedPrompt}
        rerender={rerender}
        setRerender={setRerender}
        sessionMessages={sessionMessages}
        setActivityDetection={setActivityDetection}
        promptOpen={promptOpen}
        setPromptOpen={setPromptOpen}
        micQuiet={micQuiet}
        resetPlaceholderPrompt={resetPlaceholderPrompt}
        preprocessedJobDescription={preprocessedJobDescription}
        setPreprocessedJobDescription={setPreprocessedJobDescription}
        interviewSettings={interviewSettings}
      ></Toolbar>
    </div>
  );
}

export default Console;
