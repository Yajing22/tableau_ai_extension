'use strict';

(function () {

  let unregisterFilterEventListener = null;
  let unregisterMarkSelectionEventListener = null;
  let worksheet = null;
  let worksheetName = null;
  let apisecret = null;
  let valueColumnNumber = null;

  $(document).ready(function () {
    tableau.extensions.initializeAsync({ 'configure':configure }).then(function () {
      // Draw the chart when initialising the dashboard.
      getSettings();
      openAIResponse();
      // Set up the Settings Event Listener.
      unregisterMarkSelectionEventListener = tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, (settingsEvent) => {
        // On settings change.
        getSettings();
        openAIResponse();
      });
    }, function () { console.log('Error while Initializing: ' + err.toString()); });
  });

  function getSettings() {
    // Once the settings change populate global variables from the settings.
    worksheetName = tableau.extensions.settings.get("worksheet");
    apisecret = tableau.extensions.settings.get("apisecretinput");
    valueColumnNumber = tableau.extensions.settings.get("valueColumnNumber");

    // If settings are changed we will unregister and re register the listener.
    if (unregisterFilterEventListener != null) {
      unregisterFilterEventListener();
    }
    // If settings are changed we will unregister and re register the listener.
    if (unregisterMarkSelectionEventListener != null) {
      unregisterMarkSelectionEventListener();
    }

    // Get worksheet
    worksheet=tableau.extensions.dashboardContent.dashboard.worksheets.find(function (sheet) {
      return sheet.name===worksheetName;
    });

    // Add listener
    unregisterFilterEventListener = worksheet.addEventListener(tableau.TableauEventType.FilterChanged, (filterEvent) => {
      openAIResponse();
    });

    unregisterMarkSelectionEventListener = worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, (filterEvent) => {
      openAIResponse();
    });
  }

 function openAIResponse() {
  worksheet.getSummaryDataAsync().then(function (sumdata) {
    var labels = [];
    var data = [];
    var worksheetData = sumdata.data;

    for (var i = 0; i < worksheetData.length && i < 5; i++) {
      data.push(worksheetData[i][valueColumnNumber - 1].value);
    }
    
    callAzureOpenAIAPI(data, function (insights) {
      var formattedInsights = insights.replace(/\n/g, "<br>");
      var data_table = $("#myData");
      data_table.empty(); // Clear previous content
      data_table.append(formattedInsights);
    });
  });
}

function callAzureOpenAIAPI(inputData, callback) {
  var text = inputData.join('\n');
  var apiKey = apisecret; 

  fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      'model' :  "gpt-3.5-turbo",
      'messages' : [
        {'role': 'user', 'content': 'summarize reviews below into 3 insights and each in 10 words, satrt with numeric counts such as 1. 2.'},
        {'role': 'assistant', 'content': text}
      ],
      max_tokens: 50,
      top_p: 0.5
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      var insights = data.choices[0].message.content;
      callback(insights);
    })
    .catch((error) => {
      console.error('Error calling Azure OpenAI API:', error);
    });
}

  function configure() {
    const popupUrl=`${window.location.origin}/dialog.html`;
    let defaultPayload="";
    tableau.extensions.ui.displayDialogAsync(popupUrl, defaultPayload, { height:300, width:500 }).then((closePayload) => {
      openAIResponse();
    }).catch((error) => {
      switch (error.errorCode) {
        case tableau.ErrorCodes.DialogClosedByUser:
          console.log("Dialog was closed by user");
          break;
        default:
          console.error(error.message);
      }
    });
  }

})();