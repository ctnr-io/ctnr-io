{{- define "ctnr-compose.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "ctnr-compose.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "ctnr-compose.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "ctnr-compose.labels" -}}
helm.sh/chart: {{ include "ctnr-compose.chart" . }}
{{ include "ctnr-compose.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "ctnr-compose.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ctnr-compose.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "ctnr-compose.apiName" -}}
{{- printf "%s-api" (include "ctnr-compose.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "ctnr-compose.appName" -}}
{{- printf "%s-app" (include "ctnr-compose.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
