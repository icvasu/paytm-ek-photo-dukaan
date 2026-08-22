import { ApiPaytmService, type PaytmService } from './paytm/PaytmService'
import { ruleBasedIntelligence, type IntelligenceEngine } from '../intelligence/engine'

export const paytmService: PaytmService = new ApiPaytmService()
export const intelligenceEngine: IntelligenceEngine = ruleBasedIntelligence
