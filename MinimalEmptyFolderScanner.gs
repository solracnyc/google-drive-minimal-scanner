/**
 * Minimal Empty Folder Scanner for Google Drive
 * 
 * SETUP INSTRUCTIONS:
 * 1. Replace FOLDER_1_ID and FOLDER_2_ID below with your actual folder IDs
 * 2. Save this file (Ctrl+S or Cmd+S)
 * 3. Run > scanForEmptyFolders
 * 4. Authorize when prompted
 * 5. Check your spreadsheet for results
 * 
 * This scanner handles large folders by automatically continuing if time runs out.
 * Progress is saved so it can resume where it left off.
 */

// ===== CONFIGURATION - REPLACE THESE WITH YOUR FOLDER IDs =====
const FOLDER_1_ID = "PASTE_YOUR_FIRST_FOLDER_ID_HERE";
const FOLDER_2_ID = "PASTE_YOUR_SECOND_FOLDER_ID_HERE";

// ===== CONSTANTS =====
const BATCH_SIZE = 50; // Process folders in batches
const TIME_LIMIT_MS = 4 * 60 * 1000; // 4 minutes (leaving 2 min buffer)
const SHEET_NAME = "Empty Folders";
const DEBUG_SHEET_NAME = "Debug Log";
const PROPERTY_KEY = "MinimalScannerState";

// ===== MAIN FUNCTION =====
function scanForEmptyFolders() {
  const startTime = new Date().getTime();
  
  try {
    // Initialize or get existing state
    let state = loadState();
    
    if (!state) {
      // First run - initialize everything
      debugLog("Starting new scan...");
      setupSheets();
      
      // Validate folder IDs first
      const validatedFolders = validateFolderAccess();
      if (validatedFolders.length === 0) {
        SpreadsheetApp.getUi().alert(
          'No Valid Folders', 
          'Could not access any of the specified folders. Please check:\n\n' +
          '1. The folder IDs are correct (check the URL in Google Drive)\n' +
          '2. The folders are shared with your account\n' +
          '3. You have at least "Viewer" permission\n\n' +
          'Run testFolderAccess() to see detailed error messages.', 
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }
      
      state = {
        folders: validatedFolders,
        currentFolderIndex: 0,
        emptyFoldersFound: 0,
        totalFoldersScanned: 0,
        folderQueue: [],
        processedFolders: {}
      };
      saveState(state);
    } else {
      debugLog("Resuming previous scan...");
    }
    
    // Process folders until time runs out or we're done
    while (shouldContinue(startTime)) {
      // Check if we need to move to next main folder
      if (state.folderQueue.length === 0) {
        if (state.currentFolderIndex >= state.folders.length) {
          // All done!
          completeScan(state);
          return;
        }
        
        // Start processing next main folder
        const mainFolder = state.folders[state.currentFolderIndex];
        if (!mainFolder.processed) {
          debugLog(`Starting scan of ${mainFolder.name} (${mainFolder.id})`);
          state.folderQueue = [{ id: mainFolder.id, path: "", parentName: "Root" }];
          mainFolder.processed = true;
          state.currentFolderIndex++;
        }
      }
      
      // Process a batch of folders
      processFolderBatch(state, startTime);
      
      // Save progress
      saveState(state);
      
      // Update progress every 20 folders
      if (state.totalFoldersScanned % 20 === 0) {
        showProgress(state);
      }
    }
    
    // Time running out - schedule continuation
    scheduleContinuation();
    debugLog("Scheduling automatic continuation in 1 minute...");
    
  } catch (error) {
    logError("Critical error in main function", error);
    SpreadsheetApp.getUi().alert(
      'Error', 
      `An error occurred: ${error.message}\n\nCheck the Debug Log sheet for details.`, 
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

// ===== PROCESSING FUNCTIONS =====
function processFolderBatch(state, startTime) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const batchResults = [];
  
  let processed = 0;
  while (state.folderQueue.length > 0 && processed < BATCH_SIZE && shouldContinue(startTime)) {
    const current = state.folderQueue.shift();
    
    // Skip if already processed (deduplication)
    if (state.processedFolders[current.id]) {
      continue;
    }
    
    try {
      // Get folder info
      const folder = DriveApp.getFolderById(current.id);
      const folderInfo = getFolderInfo(folder, current.path, current.parentName);
      
      // Check if empty
      const isEmpty = isEmptyFolder(folder);
      
      if (isEmpty) {
        batchResults.push(folderInfo);
        state.emptyFoldersFound++;
      }
      
      // Add subfolders to queue
      const subfolders = folder.getFolders();
      while (subfolders.hasNext()) {
        const subfolder = subfolders.next();
        state.folderQueue.push({
          id: subfolder.getId(),
          path: current.path ? `${current.path} > ${folder.getName()}` : folder.getName(),
          parentName: folder.getName()
        });
      }
      
      state.processedFolders[current.id] = true;
      state.totalFoldersScanned++;
      processed++;
      
    } catch (error) {
      debugLog(`Error processing folder ${current.id}: ${error.message}`);
    }
  }
  
  // Write batch results to sheet
  if (batchResults.length > 0) {
    writeBatchToSheet(sheet, batchResults);
  }
}

function isEmptyFolder(folder) {
  try {
    // Check for files
    const files = folder.getFiles();
    if (files.hasNext()) {
      return false;
    }
    
    // Check for subfolders
    const subfolders = folder.getFolders();
    if (subfolders.hasNext()) {
      return false;
    }
    
    return true;
  } catch (error) {
    debugLog(`Error checking if folder is empty: ${error.message}`);
    return false;
  }
}

function getFolderInfo(folder, path, parentName) {
  try {
    const owner = folder.getOwner();
    const lastModified = folder.getLastUpdated();
    
    return [
      folder.getName(),                    // Folder Name
      folder.getId(),                      // Folder ID
      folder.getUrl(),                     // Link
      path || "Root",                      // Path
      "Shared with me",                    // Drive Type
      "Shared with me",                    // Drive Name
      parentName || "N/A",                 // Parent Folder
      lastModified,                        // Last Modified
      owner ? owner.getEmail() : "Unknown", // Owner
      false,                               // Delete?
      "N/A"                               // Drive ID
    ];
  } catch (error) {
    debugLog(`Error getting folder info: ${error.message}`);
    return [
      folder.getName(),
      folder.getId(),
      "#ERROR",
      path || "Root",
      "Shared with me",
      "Shared with me",
      parentName || "N/A",
      new Date(),
      "Unknown",
      false,
      "N/A"
    ];
  }
}

// ===== SHEET MANAGEMENT =====
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Setup main results sheet
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  } else {
    sheet.clear();
  }
  
  // Add headers
  const headers = [
    "Folder Name", "Folder ID", "Link", "Path", "Drive Type", 
    "Drive Name", "Parent Folder", "Last Modified", "Owner", "Delete?", "Drive ID"
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  
  // Setup debug sheet
  let debugSheet = ss.getSheetByName(DEBUG_SHEET_NAME);
  if (!debugSheet) {
    debugSheet = ss.insertSheet(DEBUG_SHEET_NAME);
  } else {
    debugSheet.clear();
  }
  
  debugSheet.getRange(1, 1, 1, 2).setValues([["Timestamp", "Message"]]);
  debugSheet.getRange(1, 1, 1, 2).setFontWeight("bold");
  debugSheet.setFrozenRows(1);
  
  debugLog("Sheets initialized successfully");
}

function writeBatchToSheet(sheet, batch) {
  if (batch.length === 0) return;
  
  const lastRow = sheet.getLastRow();
  const startRow = lastRow + 1;
  
  sheet.getRange(startRow, 1, batch.length, batch[0].length).setValues(batch);
  
  // Format the Delete? column as checkboxes
  sheet.getRange(startRow, 10, batch.length, 1).insertCheckboxes();
  
  // Format dates
  sheet.getRange(startRow, 8, batch.length, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
}

// ===== STATE MANAGEMENT =====
function loadState() {
  try {
    const stateJson = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEY);
    return stateJson ? JSON.parse(stateJson) : null;
  } catch (error) {
    debugLog(`Error loading state: ${error.message}`);
    return null;
  }
}

function saveState(state) {
  try {
    PropertiesService.getScriptProperties().setProperty(PROPERTY_KEY, JSON.stringify(state));
  } catch (error) {
    debugLog(`Error saving state: ${error.message}`);
  }
}

function clearState() {
  PropertiesService.getScriptProperties().deleteProperty(PROPERTY_KEY);
}

// ===== UTILITY FUNCTIONS =====
function shouldContinue(startTime) {
  return (new Date().getTime() - startTime) < TIME_LIMIT_MS;
}

function scheduleContinuation() {
  // Delete any existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'scanForEmptyFolders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger for 1 minute from now
  ScriptApp.newTrigger('scanForEmptyFolders')
    .timeBased()
    .after(1 * 60 * 1000)
    .create();
}

function completeScan(state) {
  // Clear state
  clearState();
  
  // Delete any triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'scanForEmptyFolders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Add summary row
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  sheet.getRange(lastRow + 2, 1).setValue("SCAN COMPLETE");
  sheet.getRange(lastRow + 3, 1).setValue(`Total folders scanned: ${state.totalFoldersScanned}`);
  sheet.getRange(lastRow + 4, 1).setValue(`Empty folders found: ${state.emptyFoldersFound}`);
  sheet.getRange(lastRow + 5, 1).setValue(`Scan completed at: ${new Date()}`);
  
  sheet.getRange(lastRow + 2, 1, 4, 1).setFontWeight("bold");
  
  debugLog(`Scan complete! Found ${state.emptyFoldersFound} empty folders out of ${state.totalFoldersScanned} total.`);
  
  // Show completion message
  SpreadsheetApp.getUi().alert(
    'Scan Complete', 
    `Found ${state.emptyFoldersFound} empty folders out of ${state.totalFoldersScanned} folders scanned.\n\nCheck the "${SHEET_NAME}" sheet for results.`, 
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function showProgress(state) {
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Scanned ${state.totalFoldersScanned} folders, found ${state.emptyFoldersFound} empty folders so far...`,
    'Scan Progress',
    3
  );
}

// ===== DEBUG FUNCTIONS =====
function debugLog(message) {
  try {
    const debugSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DEBUG_SHEET_NAME);
    if (debugSheet) {
      debugSheet.appendRow([new Date(), message]);
    }
    console.log(message);
  } catch (error) {
    console.error("Error writing to debug log:", error);
  }
}

function logError(context, error) {
  const errorMessage = `ERROR in ${context}: ${error.message}`;
  debugLog(errorMessage);
  console.error(context, error);
}

// ===== VALIDATION FUNCTIONS =====
function validateFolderAccess() {
  const validatedFolders = [];
  const folderIds = [FOLDER_1_ID, FOLDER_2_ID];
  
  for (let i = 0; i < folderIds.length; i++) {
    const folderId = folderIds[i];
    const folderName = `Folder ${i + 1}`;
    
    try {
      if (!folderId || folderId === "PASTE_YOUR_FIRST_FOLDER_ID_HERE" || folderId === "PASTE_YOUR_SECOND_FOLDER_ID_HERE") {
        debugLog(`${folderName}: No folder ID provided - skipping`);
        continue;
      }
      
      // Try to access the folder
      const folder = DriveApp.getFolderById(folderId);
      
      // Try to get basic info to ensure we have access
      const folderTestName = folder.getName();
      
      debugLog(`${folderName}: Successfully accessed "${folderTestName}" (${folderId})`);
      validatedFolders.push({ 
        id: folderId, 
        name: folderTestName, 
        processed: false 
      });
      
    } catch (error) {
      debugLog(`${folderName} (${folderId}): ACCESS ERROR - ${error.message}`);
      
      // Show specific error message
      let errorType = "Unknown error";
      if (error.message.includes("No item with the given ID")) {
        errorType = "Folder not found or no permission";
      } else if (error.message.includes("Unexpected error")) {
        errorType = "Invalid folder ID format";
      }
      
      debugLog(`${folderName}: ${errorType}`);
    }
  }
  
  return validatedFolders;
}

// ===== TEST FUNCTIONS =====
function testFolderAccess() {
  debugLog("=== TESTING FOLDER ACCESS ===");
  
  const folderIds = [
    { id: FOLDER_1_ID, name: "Folder 1" },
    { id: FOLDER_2_ID, name: "Folder 2" }
  ];
  
  let accessibleCount = 0;
  let messages = [];
  
  for (const folderInfo of folderIds) {
    try {
      if (!folderInfo.id || folderInfo.id.startsWith("PASTE_YOUR_")) {
        messages.push(`❌ ${folderInfo.name}: No folder ID provided`);
        continue;
      }
      
      const folder = DriveApp.getFolderById(folderInfo.id);
      const folderName = folder.getName();
      const owner = folder.getOwner();
      
      messages.push(`✅ ${folderInfo.name}: "${folderName}" (Owner: ${owner ? owner.getEmail() : 'Unknown'})`);
      accessibleCount++;
      
    } catch (error) {
      let errorMsg = `❌ ${folderInfo.name} (${folderInfo.id}): `;
      
      if (error.message.includes("No item with the given ID")) {
        errorMsg += "Folder not found or you don't have permission to access it";
      } else if (error.message.includes("Unexpected error")) {
        errorMsg += "Invalid folder ID format";
      } else {
        errorMsg += error.message;
      }
      
      messages.push(errorMsg);
    }
  }
  
  // Show results
  const resultMessage = `FOLDER ACCESS TEST RESULTS:\n\n${messages.join('\n')}\n\nAccessible folders: ${accessibleCount} out of ${folderIds.length}`;
  
  SpreadsheetApp.getUi().alert('Folder Access Test', resultMessage, SpreadsheetApp.getUi().ButtonSet.OK);
  debugLog("=== FOLDER ACCESS TEST COMPLETE ===");
}

// ===== MANUAL CONTROL FUNCTIONS =====
function resetScan() {
  clearState();
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  SpreadsheetApp.getUi().alert('Scan Reset', 'The scan has been reset. You can start fresh.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function checkScanStatus() {
  const state = loadState();
  if (!state) {
    SpreadsheetApp.getUi().alert('No Active Scan', 'No scan is currently in progress.', SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    SpreadsheetApp.getUi().alert(
      'Scan Status',
      `Folders scanned: ${state.totalFoldersScanned}\nEmpty folders found: ${state.emptyFoldersFound}\nFolders in queue: ${state.folderQueue.length}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}