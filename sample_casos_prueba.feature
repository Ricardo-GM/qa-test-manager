# language: es
@modulo:originacion @regresion
Característica: Solicitud de Datos Generales
  Como operador del sistema de originación
  Quiero cargar y validar los datos generales de una solicitud de crédito
  Para iniciar el proceso de evaluación financiera

  Antecedentes:
    Dado que el usuario inicia sesión con credenciales de operador
    Y accede al formulario de nueva solicitud

  @smoke @alta @TC-001
  Escenario: Carga exitosa de datos generales válidos
    Dado que el usuario se encuentra en la pestaña "Datos Generales"
    Cuando completa el CUIT "30-71234567-8"
    Y selecciona el tipo societario "Sociedad Anónima"
    Y completa la razón social "Molinos Agro S.A."
    Y presiona el botón "Guardar y Continuar"
    Entonces el sistema muestra el mensaje de confirmación "Datos guardados correctamente"
    Y el estado de la solicitud cambia a "En Revisión"

  @alta @TC-002
  Escenario: Error al ingresar CUIT con formato o dígito verificador inválido
    Dado que el usuario se encuentra en la pestaña "Datos Generales"
    Cuando completa el CUIT "00-00000000-0"
    Y presiona el botón "Guardar y Continuar"
    Entonces el sistema resalta el campo CUIT en rojo
    Y muestra el mensaje de error "El CUIT ingresado no es válido ante AFIP"

  @media @TC-003
  Esquema del escenario: Validación de obligatoriedad en campos mandatarios
    Dado que el usuario se encuentra en el formulario de datos generales
    Cuando deja vacío el campo obligatorio "<campo>"
    Y presiona "Guardar y Continuar"
    Entonces el sistema impide el avance y muestra la alerta "<mensaje_error>"

    Ejemplos:
      | campo         | mensaje_error                            |
      | CUIT          | Debe ingresar un CUIT obligatorio        |
      | Razón Social  | La Razón Social no puede estar en blanco |
      | Actividad     | Debe seleccionar la actividad principal  |
