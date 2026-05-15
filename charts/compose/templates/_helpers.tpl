{{- define "ctnr-compose.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "ctnr-compose.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "ctnr-compose.namespace" -}}
{{- .Release.Namespace -}}
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

{{- define "ctnr-compose.svcName" -}}
{{- printf "%s-%s" (include "ctnr-compose.fullname" .root) .name | replace "_" "-" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "ctnr-compose.volumeName" -}}
{{- . | replace "." "-" | replace "/" "-" -}}
{{- end -}}
