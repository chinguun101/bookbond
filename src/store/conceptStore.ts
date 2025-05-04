import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Concept, PassageSummary, ConceptRelation } from '@/lib/conceptProcessing';
import { generateId } from '@/lib/textProcessing';

interface ConceptState {
  concepts: Concept[];
  passageSummaries: PassageSummary[];
  conceptRelations: ConceptRelation[];
  
  // Concept operations
  addConcept: (concept: Concept) => void;
  getConcept: (conceptId: string) => Concept | undefined;
  getConceptsForPassage: (passageId: string) => Concept[];
  
  // Passage summary operations
  addPassageSummary: (summary: PassageSummary) => void;
  getPassageSummary: (passageId: string) => PassageSummary | undefined;
  getPassageSummariesForBook: (bookId: string) => PassageSummary[];
  
  // Relation operations
  addConceptRelation: (relation: ConceptRelation) => void;
  getRelationsForPassage: (passageId: string) => ConceptRelation[];
  
  // Batch operations
  addPassageSummariesBatch: (summaries: PassageSummary[]) => void;
  
  // Analysis helpers
  findRelatedPassages: (passageId: string, relationType?: 'supports' | 'contradicts' | 'extends' | 'analogous') => {
    passage: PassageSummary;
    relation: ConceptRelation;
  }[];
}

export const useConceptStore = create<ConceptState>()(
  persist(
    (set, get) => ({
      concepts: [],
      passageSummaries: [],
      conceptRelations: [],
      
      // Concept operations
      addConcept: (concept) => {
        set((state) => {
          const existingIndex = state.concepts.findIndex(c => c.id === concept.id);
          if (existingIndex >= 0) {
            const updatedConcepts = [...state.concepts];
            updatedConcepts[existingIndex] = concept;
            return { concepts: updatedConcepts };
          }
          
          return { concepts: [...state.concepts, concept] };
        });
      },
      
      getConcept: (conceptId) => {
        return get().concepts.find(concept => concept.id === conceptId);
      },
      
      getConceptsForPassage: (passageId) => {
        const summary = get().passageSummaries.find(s => s.passageId === passageId);
        if (!summary) return [];
        
        return summary.concepts
          .map(conceptId => get().concepts.find(c => c.id === conceptId))
          .filter((concept): concept is Concept => concept !== undefined);
      },
      
      // Passage summary operations
      addPassageSummary: (summary) => {
        set((state) => {
          const existingIndex = state.passageSummaries.findIndex(s => s.passageId === summary.passageId);
          if (existingIndex >= 0) {
            const updatedSummaries = [...state.passageSummaries];
            updatedSummaries[existingIndex] = summary;
            return { passageSummaries: updatedSummaries };
          }
          
          return { passageSummaries: [...state.passageSummaries, summary] };
        });
      },
      
      getPassageSummary: (passageId) => {
        return get().passageSummaries.find(summary => summary.passageId === passageId);
      },
      
      getPassageSummariesForBook: (bookId) => {
        return get().passageSummaries.filter(summary => summary.bookId === bookId);
      },
      
      // Relation operations  
      addConceptRelation: (relation) => {
        set((state) => {
          // Check if this relation or its reverse already exists
          const exists = state.conceptRelations.some(
            r => (r.fromPassageId === relation.fromPassageId && r.toPassageId === relation.toPassageId) ||
                 (r.fromPassageId === relation.toPassageId && r.toPassageId === relation.fromPassageId)
          );
          
          if (exists) return state;
          
          return { conceptRelations: [...state.conceptRelations, relation] };
        });
      },
      
      getRelationsForPassage: (passageId) => {
        return get().conceptRelations.filter(
          relation => relation.fromPassageId === passageId || relation.toPassageId === passageId
        );
      },
      
      // Batch operations
      addPassageSummariesBatch: (summaries) => {
        set((state) => {
          const updatedSummaries = [...state.passageSummaries];
          const newConcepts: Concept[] = [];
          
          // Process each summary
          summaries.forEach(summary => {
            // Check if we already have this summary
            const existingIndex = updatedSummaries.findIndex(s => s.passageId === summary.passageId);
            
            if (existingIndex >= 0) {
              // Update existing summary
              updatedSummaries[existingIndex] = summary;
            } else {
              // Add new summary
              updatedSummaries.push(summary);
            }
            
            // Process concepts from the summary
            summary.concepts.forEach(conceptName => {
              // Check if this concept already exists by name
              const existingConcept = [...state.concepts, ...newConcepts].find(c => c.name.toLowerCase() === conceptName.toLowerCase());
              
              if (existingConcept) {
                // Add this passage to the existing concept
                if (!existingConcept.passages.includes(summary.passageId)) {
                  existingConcept.passages.push(summary.passageId);
                }
              } else {
                // Create a new concept
                const newConcept: Concept = {
                  id: generateId(),
                  name: conceptName,
                  description: '',
                  passages: [summary.passageId]
                };
                
                newConcepts.push(newConcept);
              }
            });
          });
          
          return { 
            passageSummaries: updatedSummaries,
            concepts: [...state.concepts, ...newConcepts]
          };
        });
      },
      
      // Analysis helpers
      findRelatedPassages: (passageId, relationType) => {
        const relations = get().conceptRelations.filter(
          relation => (relation.fromPassageId === passageId || relation.toPassageId === passageId) &&
                    (!relationType || relation.type === relationType)
        );
        
        return relations.map(relation => {
          const otherPassageId = relation.fromPassageId === passageId ? relation.toPassageId : relation.fromPassageId;
          const passage = get().passageSummaries.find(s => s.passageId === otherPassageId);
          
          if (!passage) {
            throw new Error(`Related passage ${otherPassageId} not found`);
          }
          
          return { passage, relation };
        });
      }
    }),
    {
      name: 'concept-storage',
    }
  )
); 