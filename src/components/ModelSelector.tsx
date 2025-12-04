import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLLMModel, LLM_MODELS, VISION_MODELS, LLMModel, formatModelPrice } from '@/hooks/use-llm-model'
import { Sparkle, Eye, CurrencyDollar } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'

export function ModelSelector() {
  const { standardModel, setStandardModel, visionModel, setVisionModel } = useLLMModel()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkle className="text-primary" size={20} />
            <CardTitle className="text-base">Standard-Modell</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Fuer Notizen, Aufgaben und Karteikarten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="standard-model" className="text-sm">Modell</Label>
            <Select value={standardModel} onValueChange={(value) => setStandardModel(value as LLMModel)}>
              <SelectTrigger id="standard-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-96">
                {LLM_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    <div className="flex flex-col gap-0.5 py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.label}</span>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">Chat</Badge>
                        {model.supportsVision && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-blue-100 text-blue-800">Vision</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{model.description}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CurrencyDollar size={10} />
                        {formatModelPrice(model)} - {(model.contextWindow / 1000).toFixed(0)}K Kontext
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Eye className="text-primary" size={20} />
            <CardTitle className="text-base">Vision-Modell</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Fuer Handschrifterkennung und Bildanalyse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="vision-model" className="text-sm">Modell</Label>
            <Select value={visionModel} onValueChange={(value) => setVisionModel(value as LLMModel)}>
              <SelectTrigger id="vision-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-96">
                {VISION_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    <div className="flex flex-col gap-0.5 py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.label}</span>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">Chat</Badge>
                        {model.supportsVision && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-blue-100 text-blue-800">Vision</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{model.description}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CurrencyDollar size={10} />
                        {formatModelPrice(model)} - {(model.contextWindow / 1000).toFixed(0)}K Kontext
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
