function doPost(e) {
  try {
    // Tomar la hoja de Google Sheets a la que está atado el script
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName("PUNTUACION INPUT"); // Escribimos en la pestaña concreta
    
    // Parseamos los datos enviados por la app
    var data = JSON.parse(e.postData.contents);
    
    // Preparar encabezados para buscar qué columna es la de Equipo y Prueba
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Variables para ubicar si existe un registro igual
    var colPrueba = -1;
    var colEquipo = -1;
    
    // Buscar la posición exacta de cada columna
    for (var i = 0; i < headers.length; i++) {
        var header = headers[i].toString().toLowerCase();
        if (header.indexOf('prueba') !== -1) colPrueba = i;
        if (header.indexOf('equipo') !== -1) colEquipo = i;
    }
    
    var rowIndexToUpdate = -1;
    
    // Si encontramos dónde están ambas columnas, buscamos filas duplicadas
    if (colPrueba !== -1 && colEquipo !== -1) {
        // Traer todos los datos actuales para analizarlos (sin encabezados)
        var lastRowLimit = sheet.getLastRow();
        if (lastRowLimit > 1) {
             var currentData = sheet.getRange(2, 1, lastRowLimit - 1, sheet.getLastColumn()).getValues();
             
             for (var r = 0; r < currentData.length; r++) {
                 // Convertimos todo a minúsculas para que las comparaciones sean exactas
                 var valPrueba = currentData[r][colPrueba].toString().trim().toLowerCase();
                 var valEquipo = currentData[r][colEquipo].toString().trim().toLowerCase();
                 
                 var insertPrueba = (data.codigoPrueba || '').toString().trim().toLowerCase();
                 var insertEquipo = (data.equipo || '').toString().trim().toLowerCase();
                 
                 // Si coinciden Prueba y Equipo, hemos encontrado la fila
                 if (valPrueba === insertPrueba && valEquipo === insertEquipo) {
                     rowIndexToUpdate = r + 2; // +2 porque r empieza en 0 y la primera fila (1) es el encabezado
                     break; 
                 }
             }
        }
    }
    
    // Construir la nueva Fila
    var newRow = [];
    var fechaYHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i].toString().toLowerCase();
      
      if (header.indexOf('fecha') !== -1) {
        newRow.push(fechaYHora); // Guardado con Fecha y Hora exacta
      } else if (header.indexOf('voluntario') !== -1 || header.indexOf('nombre') !== -1 || header.indexOf('responsable') !== -1) {
         newRow.push(data.nombre || '');
      } else if (header.indexOf('prueba') !== -1) {
         newRow.push(data.codigoPrueba || '');
      } else if (header.indexOf('categor') !== -1) {
         newRow.push(data.categoriaPrueba || '');
      } else if (header.indexOf('modalidad') !== -1) {
         newRow.push(data.modalidad || '');
      } else if (header.indexOf('equipo') !== -1) {
         newRow.push(data.equipo || '');
      } else if (header.indexOf('puntuaci') !== -1) {
         newRow.push(data.puntuacion || '');
      } else {
         newRow.push('');
      }
    }
    
    // Si encontramos una fila, la actualizamos. Si no, añadimos una nueva abajo del todo.
    if (rowIndexToUpdate !== -1) {
       sheet.getRange(rowIndexToUpdate, 1, 1, newRow.length).setValues([newRow]);
    } else {
       var nextRow = sheet.getLastRow() + 1;
       sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "action": (rowIndexToUpdate !== -1 ? "updated" : "inserted") })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "error": error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
