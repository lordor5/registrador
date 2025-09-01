Este  es otro bot que reserva plazas en el gimnasio de la UPV

La diferencia entre este y los otros bots que se pueden encontrar en GitHub radica en que este código se ejecuta automáticamente el el cloud (GitHub actions) por lo que no hay que instalar nada ni dejar un ordenador encendido.


Para usarlo simplemente hay que: 
1. Clonar el repositorio
2. Configurar el DNI y la contraseña en el apartado de secrets de github para mantenerlos seguros
3 Configurar las horas en el archivo time.json. Hay que mantener el formato que usa la UPV para cada sesión como está en el archivo de ejemplo
4. asegurarse que las actions están habilitadas
